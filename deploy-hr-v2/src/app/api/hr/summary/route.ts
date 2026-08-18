import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  initDbClients,
  createHrDb,
  createMasterDb,
  hrDailySummary,
  masterOutlet,
} from "../../../../../_packages/schema/src/index";
import { requireRole, Role, applyOutletScope } from "../../../../../_packages/auth/src/index";
import { generateHrDailySummary } from "../../../../../_packages/engine/src/index";
import { jsonOk, jsonError, handleError } from "@hr/lib/api-error";
import { resolveBody, resolveQuery } from "@hr/lib/zod-resolver";

export const dynamic = "force-dynamic";

let booted = false;
function boot(): void {
  if (booted) return;
  try {
    initDbClients();
    booted = true;
  } catch {
    // ignore in test env
  }
}

const querySchema = z.object({
  date: z.string().optional(),
  outletId: z.string().optional(),
});

const rebuildSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  outletId: z.string().optional(),
});

/**
 * GET /api/hr/summary
 * Lists hr_daily_summary rows with optional date / outlet filters.
 */
export async function GET(req: Request): Promise<Response> {
  boot();
  try {
    const user = await requireRole([Role.OWNER, Role.HR_ADMIN, Role.SUPER_ADMIN, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER]);
    const url = new URL(req.url);
    const parsed = resolveQuery(url, querySchema);
    if (parsed instanceof Response) return parsed;

    const hrDb = createHrDb();
    const filters = [];
    if (parsed.date) filters.push(eq(hrDailySummary.date, new Date(parsed.date)));
    // Defect H2 fix: filter by outletId (ID column) not outlet (NAME). The
    // old query compared the outletId query param to hr_daily_summary.outlet,
    // which stores the outlet NAME, so cross-outlet IDs matched nothing.
    if (parsed.outletId) filters.push(eq(hrDailySummary.outletId, parsed.outletId));
    applyOutletScope(user, filters, hrDailySummary.outletId);

    const rows = await hrDb
      .select()
      .from(hrDailySummary)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(hrDailySummary.date, hrDailySummary.outlet)
      .limit(365);

    return jsonOk({ summaries: rows });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/hr/summary/rebuild
 * Idempotently regenerate hr_daily_summary for the date and (optional)
 * outlet. If no outlet is supplied, rebuild for every active master outlet.
 */
export async function POST(req: Request): Promise<Response> {
  boot();
  try {
    await requireRole([Role.OWNER, Role.HR_ADMIN, Role.SUPER_ADMIN, Role.OUTLET_MANAGER]);
    const parsed = await resolveBody(req, rebuildSchema);
    if (parsed instanceof Response) return parsed;

    const masterDb = createMasterDb();
    const hrDb = createHrDb();

    const outletIds: string[] = [];
    if (parsed.outletId) {
      outletIds.push(parsed.outletId);
    } else {
      const outlets = await masterDb
        .select({ outletId: masterOutlet.outletId })
        .from(masterOutlet)
        .where(eq(masterOutlet.status, "active"));
      outletIds.push(...outlets.map((o) => o.outletId));
    }

    let rebuilt = 0;
    for (const outletId of outletIds) {
      await generateHrDailySummary({
        hrDb,
        masterDb,
        date: parsed.date,
        outlet_id: outletId,
      }).catch(() => null);
      rebuilt += 1;
    }

    return jsonOk({ rebuilt });
  } catch (err) {
    return handleError(err);
  }
}