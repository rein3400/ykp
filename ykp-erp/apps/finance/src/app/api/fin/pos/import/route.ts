/**
 * POST /api/fin/pos/import — Moka POS CSV import (multipart or raw text).
 *
 * Body can be:
 *   - multipart/form-data with field `file` (CSV/XLSX) — for browser upload
 *   - raw text/csv body (Content-Type: text/csv) — for curl / agent use
 *
 * Each CSV line is parsed via @ykp/engine parseMokaCsv into one receipt,
 * validated against master.outlet / master.brand, then inserted into
 * fin_pos_receipts (one row per receipt). Duplicates on
 * (date, outlet_id, receipt_number) are recorded as errors and skipped.
 *
 * Hard limits:
 *   - body size: 10 MiB (Content-Length header when available; otherwise
 *     we cap the string length to 10 MiB worth of UTF-8 bytes)
 *   - inserts run inside a single DB transaction so a batch is atomic.
 * Returns {rows_imported, errors[]}.
 */
import { eq, and } from "drizzle-orm";
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { finPosReceipts, masterOutlet, masterBrand } from "@ykp/schema";
import { getMasterDb, getFinanceDb, type FinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { logFinanceAudit } from "@finance/lib/server/audit";
import { parseMokaCsv, receiptId, type MokaParsedReceipt } from "@ykp/engine";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

type ResolvedReceipt = MokaParsedReceipt & {
  outletId: string;
  brandId: string;
  brandName: string;
};

/** Next receipt sequence for (date, outlet) — count existing + 1. */
async function getNextReceiptSeq(
  db: FinanceDb,
  date: string,
  outletId: string,
): Promise<number> {
  const rows = await db
    .select({ receiptId: finPosReceipts.receiptId })
    .from(finPosReceipts)
    .where(
      and(
        eq(finPosReceipts.date, new Date(date)),
        eq(finPosReceipts.outletId, outletId),
      ),
    );
  return rows.length + 1;
}

export const POST = handler(async (req: Request) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN,
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.OUTLET_MANAGER,
  ]);

  // Reject oversize uploads up-front so we never buffer huge bodies in memory.
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES) {
    return fail(
      "validation_error",
      `CSV body exceeds ${MAX_BYTES} byte limit (got ${contentLength})`,
    );
  }

  let csvText = "";
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (file instanceof File) {
      if (file.size > MAX_BYTES) {
        return fail(
          "validation_error",
          `CSV file exceeds ${MAX_BYTES} byte limit (got ${file.size})`,
        );
      }
      csvText = await file.text();
    } else {
      return fail("validation_error", "Missing 'file' field in multipart body");
    }
  } else {
    csvText = await req.text();
    // Defect F2 / F11a: byte-length cap (UTF-8) instead of UTF-16 code units.
    const byteLen = Buffer.byteLength(csvText, "utf8");
    if (byteLen > MAX_BYTES) {
      return fail(
        "validation_error",
        `CSV body exceeds ${MAX_BYTES} byte limit (got ${byteLen})`,
      );
    }
  }

  if (!csvText.trim()) return fail("validation_error", "Empty CSV body");

  const parsed = parseMokaCsv(csvText);
  const masterDb = getMasterDb();
  const financeDb = getFinanceDb();

  const imported: { receipt_id: string; date: string; outlet_id: string }[] = [];
  const errors: { row: number; reason: string }[] = [];

  // Match each parsed row to a real outlet by name (one DB hit, not N).
  const [outlets, brands] = await Promise.all([
    masterDb.select().from(masterOutlet),
    masterDb.select().from(masterBrand),
  ]);
  const outletByName = new Map(
    outlets.map((o) => [o.outletName, o] as const),
  );
  const brandNameById = new Map(
    brands.map((b) => [b.brandId, b.brandName] as const),
  );

  // Decorate rows with resolved ids; collect the valid rows for batch ops.
  const resolved: ResolvedReceipt[] = [];
  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    const outlet = outletByName.get(row.outletName);
    if (!outlet) {
      errors.push({
        row: i + 1,
        reason: `outlet '${row.outletName}' not found in master`,
      });
      continue;
    }
    const brandName =
      row.brandName?.trim() ||
      brandNameById.get(outlet.brandId) ||
      outlet.brandId;
    resolved.push({
      ...row,
      outletId: outlet.outletId,
      brandId: outlet.brandId,
      brandName,
    });
  }

  // Per-(date, outlet) sequence counters seeded from existing rows.
  const seqCounters = new Map<string, number>();
  const dateOutletKeys = Array.from(
    new Set(resolved.map((r) => `${r.date}|${r.outletId}`)),
  );
  for (const key of dateOutletKeys) {
    const [date, outletId] = key.split("|");
    const next = await getNextReceiptSeq(financeDb, date, outletId);
    // getNextReceiptSeq returns length+1; store base-1 so first ++ yields length+1.
    seqCounters.set(key, next - 1);
  }

  // Run all inserts inside one transaction; partial failures roll back.
  await financeDb.transaction(async (tx) => {
    for (let i = 0; i < resolved.length; i++) {
      const row = resolved[i];
      const existing = await tx
        .select({ receiptId: finPosReceipts.receiptId })
        .from(finPosReceipts)
        .where(
          and(
            eq(finPosReceipts.date, new Date(row.date)),
            eq(finPosReceipts.outletId, row.outletId),
            eq(finPosReceipts.receiptNumber, row.receiptNumber),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        errors.push({
          row: i + 1,
          reason: `duplicate receipt ${row.receiptNumber}`,
        });
        continue;
      }

      const key = `${row.date}|${row.outletId}`;
      const seq = (seqCounters.get(key) ?? 0) + 1;
      seqCounters.set(key, seq);
      const id = receiptId(row.date, row.outletId, seq);

      // net_sales = gross - discount - refund - void (integer IDR).
      const netSales = Math.max(
        0,
        row.grossSales - row.discount - row.refund - row.voidAmount,
      );

      const paymentKeys = Object.keys(row.paymentBreakdown ?? {});
      const paymentValues = Object.values(row.paymentBreakdown ?? {});
      const paymentMethodId = paymentKeys[0] ?? row.paymentMethod ?? null;
      const paymentAmount =
        paymentValues[0] ?? row.paymentAmount ?? netSales;

      await tx.insert(finPosReceipts).values({
        receiptId: id,
        date: new Date(row.date),
        brandId: row.brandId,
        brandName: row.brandName,
        outletId: row.outletId,
        outletName: row.outletName,
        receiptNumber: row.receiptNumber,
        transactionTime: row.transactionTime ?? null,
        grossSales: row.grossSales,
        discount: row.discount,
        refund: row.refund,
        void: row.voidAmount,
        tax: row.tax,
        serviceCharge: row.serviceCharge,
        netSales,
        paymentMethodId,
        paymentAmount,
        paymentBreakdown: row.paymentBreakdown ?? {},
        transactionCount: row.transactionCount,
        cashier: row.cashier ?? null,
        shift: row.shift ?? null,
        source: "moka",
        sourceRef: row.sourceRef ?? null,
        notes: row.notes ?? null,
        recordedBy: user.id,
      });

      imported.push({
        receipt_id: id,
        date: row.date,
        outlet_id: row.outletId,
      });
    }
  });

  // Attach parse errors too.
  for (const e of parsed.errors) {
    errors.push({ row: e.row, reason: `${e.field}: ${e.reason}` });
  }

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: "fin_pos_receipts:import",
    entity: "fin_pos_receipts",
    entityId: "bulk",
    after: { rows_imported: imported.length, errors: errors.length },
  });

  return ok({ rows_imported: imported.length, rows: imported, errors }, 201);
});
