/**
 * POST /api/fin/pos/import — Moka POS CSV import (multipart or raw text).
 *
 * Body can be:
 *   - multipart/form-data with field `file` (CSV/XLSX) — for browser upload
 *   - raw text/csv body (Content-Type: text/csv) — for curl / agent use
 *
 * Each row is parsed via @ykp/engine parseMokaCsv, validated against
 * master.outlet / master.brand, then aggregated into fin_pos_daily (one
 * row per (date, outlet) — same uniqueness target as the manual insert).
 *
 * Hard limits:
 *   - body size: 10 MiB (Content-Length header when available; otherwise
 *     we cap the string length to 10 MiB worth of UTF-8 bytes)
 *   - transactions run inside a single DB transaction so a batch is atomic.
 * Returns {rows_imported, errors[]}.
 */
import { eq, and, inArray } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { finPosDaily, masterOutlet } from "@ykp/schema";
import { getMasterDb, getFinanceDb } from "@/lib/server/db.js";
import { handler, ok, fail } from "@/lib/server/http.js";
import { logFinanceAudit } from "@/lib/server/audit.js";
import { parseMokaCsv, type MokaParsedRow } from "@ykp/engine";
import { financeDayId } from "@ykp/engine";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

export const POST = handler(async (req: NextRequest) => {
  const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.OUTLET_MANAGER]);

  // Reject oversize uploads up-front so we never buffer huge bodies in memory.
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES) {
    return fail("validation_error", `CSV body exceeds ${MAX_BYTES} byte limit (got ${contentLength})`);
  }

  let csvText = "";
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (file instanceof File) {
      if (file.size > MAX_BYTES) {
        return fail("validation_error", `CSV file exceeds ${MAX_BYTES} byte limit (got ${file.size})`);
      }
      csvText = await file.text();
    } else {
      return fail("validation_error", "Missing 'file' field in multipart body");
    }
  } else {
    csvText = await req.text();
    if (csvText.length > MAX_BYTES) {
      return fail("validation_error", `CSV body exceeds ${MAX_BYTES} byte limit (got ${csvText.length})`);
    }
  }

  if (!csvText.trim()) return fail("validation_error", "Empty CSV body");

  const parsed = parseMokaCsv(csvText);
  const masterDb = getMasterDb();
  const financeDb = getFinanceDb();

  const imported: { pos_id: string; date: string; outlet_id: string }[] = [];
  const errors: { row: number; reason: string }[] = [];

  // Match each parsed row to a real outlet by name (one DB hit, not N).
  const outlets = await masterDb.select().from(masterOutlet);
  const byName = new Map(outlets.map((o) => [o.outletName, o]));

  // Decorate rows with resolved ids; collect the valid rows for batch ops.
  const resolved: MokaParsedRow[] = [];
  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    const outlet = byName.get(row.outletName);
    if (!outlet) {
      errors.push({ row: i + 1, reason: `outlet '${row.outletName}' not found in master` });
      continue;
    }
    row.outletId = outlet.outletId;
    row.brandId = outlet.brandId;
    resolved.push(row);
  }

  // Find existing (date, outlet) pairs in a single query so we can split
  // the batch into an UPDATE set + an INSERT set without per-row reads.
  const dateOutletPairs = Array.from(new Set(resolved.map((r) => `${r.date}|${r.outletId}`)));
  const existingKeys = new Set<string>();
  const existingTotals = new Map<string, { grossSales: number; netSales: number }>();
  if (dateOutletPairs.length > 0) {
    const dates = Array.from(new Set(resolved.map((r) => r.date)));
    const outletIds = Array.from(new Set(resolved.map((r) => r.outletId)));
    const existing = await financeDb
      .select({
        date: finPosDaily.date,
        outletId: finPosDaily.outletId,
        posId: finPosDaily.posId,
        grossSales: finPosDaily.grossSales,
        netSales: finPosDaily.netSales,
      })
      .from(finPosDaily)
      .where(and(inArray(finPosDaily.date, dates), inArray(finPosDaily.outletId, outletIds)));
    for (const e of existing) {
      const key = `${new Date(e.date).toISOString().slice(0, 10)}|${e.outletId}`;
      existingKeys.add(key);
      existingTotals.set(key, { grossSales: e.grossSales ?? 0, netSales: e.netSales ?? 0 });
    }
  }

  // Defect F2 fix: split batch into updates vs new inserts, but for updates
  // only proceed when the new totals are within 5% of the existing totals.
  // Otherwise record a variance error and skip that row.
  const toUpdate: MokaParsedRow[] = [];
  const toInsert: MokaParsedRow[] = [];
  const VARIANCE_TOLERANCE = 0.05;
  for (const row of resolved) {
    const key = `${row.date}|${row.outletId}`;
    if (existingKeys.has(key)) {
      const ex = existingTotals.get(key);
      if (ex) {
        const refGross = ex.grossSales > 0 ? ex.grossSales : ex.netSales;
        const newGross = row.grossSales > 0 ? row.grossSales : row.netSales;
        if (refGross > 0) {
          const delta = Math.abs(newGross - refGross) / refGross;
          if (delta > VARIANCE_TOLERANCE) {
            errors.push({
              row: resolved.indexOf(row) + 1,
              reason: `variance exceeds ${VARIANCE_TOLERANCE * 100}% tolerance for ${row.date}|${row.outletName} (existing gross ${ex.grossSales}, new ${row.grossSales})`,
            });
            continue;
          }
        }
      }
      toUpdate.push(row);
    } else {
      toInsert.push(row);
    }
  }

  // Compute the next sequence number per (date, outlet) for new inserts.
  // Defect S1 fix: scope by outlet to keep ID unique across outlets.
  const insertKeys = Array.from(new Set(toInsert.map((r) => `${r.date}|${r.outletId}`)));
  const seqCounters = new Map<string, number>();
  if (insertKeys.length > 0) {
    const existingRows = await financeDb
      .select({ posId: finPosDaily.posId, date: finPosDaily.date, outletId: finPosDaily.outletId })
      .from(finPosDaily);
    for (const r of existingRows) {
      const dStr = new Date(r.date).toISOString().slice(0, 10);
      const k = `${dStr}|${r.outletId}`;
      seqCounters.set(k, (seqCounters.get(k) ?? 0) + 1);
    }
    for (const k of insertKeys) {
      if (!seqCounters.has(k)) seqCounters.set(k, 0);
    }
  }

  // Run all writes inside one transaction; partial failures roll back.
  await financeDb.transaction(async (tx) => {
    if (toInsert.length > 0) {
      const insertValues = toInsert.map((row) => {
        const k = `${row.date}|${row.outletId}`;
        const next = (seqCounters.get(k) ?? 0) + 1;
        seqCounters.set(k, next);
        const posId = financeDayId(row.date, next, row.outletId);
        return {
          posId,
          date: new Date(row.date),
          brandId: row.brandId,
          brandName: row.brandName,
          outletId: row.outletId,
          outletName: row.outletName,
          grossSales: row.grossSales,
          netSales: row.netSales,
          discount: row.discount,
          refund: row.refund,
          void: row.voidAmount,
          tax: row.tax,
          serviceCharge: row.serviceCharge,
          paymentMethodBreakdown: row.paymentMethodBreakdown,
          transactionCount: row.transactionCount,
          aov: row.aov,
          shift: row.shift ?? null,
          source: "moka" as const,
          recordedBy: user.id,
        };
      });
      const insertedRows = await tx.insert(finPosDaily).values(insertValues).returning({ posId: finPosDaily.posId, date: finPosDaily.date, outletId: finPosDaily.outletId });
      for (const r of insertedRows) {
        imported.push({
          pos_id: r.posId,
          date: new Date(r.date).toISOString().slice(0, 10),
          outlet_id: r.outletId,
        });
      }
    }

    if (toUpdate.length > 0) {
      // Drizzle lacks per-row batch update with different values; one
      // transaction per group keeps the writes atomic and avoids the N+1.
      for (const row of toUpdate) {
        const updatedRows = await tx
          .update(finPosDaily)
          .set({
            grossSales: row.grossSales,
            netSales: row.netSales,
            discount: row.discount,
            refund: row.refund,
            void: row.voidAmount,
            tax: row.tax,
            serviceCharge: row.serviceCharge,
            paymentMethodBreakdown: row.paymentMethodBreakdown,
            transactionCount: row.transactionCount,
            aov: row.aov,
            source: "moka",
            updatedAt: new Date(),
          })
          .where(and(eq(finPosDaily.date, row.date), eq(finPosDaily.outletId, row.outletId)))
          .returning({ posId: finPosDaily.posId, date: finPosDaily.date, outletId: finPosDaily.outletId });
        for (const r of updatedRows) {
          imported.push({
            pos_id: r.posId,
            date: new Date(r.date).toISOString().slice(0, 10),
            outlet_id: r.outletId,
          });
        }
      }
    }
  });

  // Attach parse errors too.
  for (const e of parsed.errors) errors.push({ row: e.row, reason: `${e.field}: ${e.reason}` });

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: "fin_pos_daily:import",
    entity: "fin_pos_daily",
    entityId: "bulk",
    after: { rows_imported: imported.length, parse_errors: errors.length },
  });

  return ok({ rows_imported: imported.length, rows: imported, errors }, 201);
});