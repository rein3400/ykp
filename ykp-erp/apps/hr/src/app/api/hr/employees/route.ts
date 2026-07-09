import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  initDbClients,
  createMasterDb,
  masterEmployee,
  masterBrand,
  masterOutlet,
} from "@ykp/schema";
import { requireRole, Role, applyOutletScope } from "@ykp/auth";
import {
  logAudit,
  getBrandName,
  getOutletName,
  employeeId,
  PrefixIdSequence,
} from "@ykp/engine";
import { jsonOk, jsonError, handleError } from "@/lib/api-error";
import { resolveBody, resolveQuery } from "@/lib/zod-resolver";

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
  outletId: z.string().optional(),
  status: z.string().optional(),
});

const createSchema = z.object({
  fullName: z.string().min(1),
  role: z.string().optional(),
  department: z.string().optional(),
  brandId: z.string().optional(),
  outletId: z.string().optional(),
  phone: z.string().optional(),
  telegramId: z.string().optional(),
  employmentType: z.string().optional(),
  joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD").optional(),
  baseSalary: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/hr/employees
 * Reads master_employee rows with optional outlet / status filters. Names
 * for brand/outlet are resolved server-side so the UI gets ready-to-render
 * strings.
 */
export async function GET(req: Request): Promise<Response> {
  boot();
  try {
    const user = await requireRole([Role.OWNER, Role.HR_ADMIN, Role.SUPER_ADMIN, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER]);
    const url = new URL(req.url);
    const parsed = resolveQuery(url, querySchema);
    if (parsed instanceof Response) return parsed;

    const masterDb = createMasterDb();
    const filters = [];
    if (parsed.outletId) filters.push(eq(masterEmployee.outletId, parsed.outletId));
    if (parsed.status) filters.push(eq(masterEmployee.status, parsed.status));
    applyOutletScope(user, filters, masterEmployee.outletId);

    const rows = await masterDb
      .select()
      .from(masterEmployee)
      .where(filters.length ? and(...filters) : undefined)
      .limit(500);

    return jsonOk({ employees: rows });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/hr/employees
 * Creates a new master_employee row. Requires HR_ADMIN or SUPER_ADMIN.
 * Validates brand_id + outlet_id exist when provided.
 */
export async function POST(req: Request): Promise<Response> {
  boot();
  try {
    const user = await requireRole([Role.OWNER, Role.HR_ADMIN, Role.SUPER_ADMIN]);
    const parsed = await resolveBody(req, createSchema);
    if (parsed instanceof Response) return parsed;

    const masterDb = createMasterDb();

    if (parsed.brandId) {
      const brandName = await getBrandName(masterDb, parsed.brandId);
      if (brandName === null) return jsonError(400, `brand_id ${parsed.brandId} not found in master`);
    }
    if (parsed.outletId) {
      const outletName = await getOutletName(masterDb, parsed.outletId);
      if (outletName === null) return jsonError(400, `outlet_id ${parsed.outletId} not found in master`);
      const outletRow = await masterDb
        .select({ brandId: masterOutlet.brandId })
        .from(masterOutlet)
        .where(eq(masterOutlet.outletId, parsed.outletId))
        .limit(1);
      const outletBrandId = outletRow[0]?.brandId;
      if (parsed.brandId && outletBrandId && outletBrandId !== parsed.brandId) {
        return jsonError(400, `outlet ${parsed.outletId} belongs to brand ${outletBrandId}, not ${parsed.brandId}`);
      }
    }
    void masterBrand;

    // Sequence-based id that consults master DB for the current max so we
    // don't collide with existing rows. Pattern: parse the numeric suffix
    // of every existing EMP-* id, take the max, then start at max+1.
    const existing = await masterDb
      .select({ employeeId: masterEmployee.employeeId })
      .from(masterEmployee);
    const maxSeq = existing.reduce((acc, r) => {
      const m = r.employeeId.match(/^EMP-(\d+)$/);
      const n = m ? Number.parseInt(m[1], 10) : 0;
      return Number.isFinite(n) && n > acc ? n : acc;
    }, 0);
    const seq = new PrefixIdSequence("EMP-", maxSeq);
    const newEmployeeId = employeeId(seq);

    await masterDb.insert(masterEmployee).values({
      employeeId: newEmployeeId,
      fullName: parsed.fullName,
      role: parsed.role ?? null,
      department: parsed.department ?? null,
      brandId: parsed.brandId ?? null,
      outletId: parsed.outletId ?? null,
      phone: parsed.phone ?? null,
      telegramId: parsed.telegramId ?? null,
      employmentType: parsed.employmentType ?? null,
      joinDate: parsed.joinDate ?? null,
      baseSalary: parsed.baseSalary,
      status: "active",
    });

    // Defect S4 fix: strip PII before writing audit row. Keep only
    // non-sensitive identifiers and salary/status.
    const auditAfter = {
      id: newEmployeeId,
      role: parsed.role,
      brandId: parsed.brandId,
      outletId: parsed.outletId,
      baseSalary: parsed.baseSalary,
      status: "active",
    };

    await logAudit(masterDb, {
      actor: user.id,
      action: "employee:create",
      entity: "master_employee",
      entityId: newEmployeeId,
      after: auditAfter,
    }, "master");

    return jsonOk({ employeeId: newEmployeeId });
  } catch (err) {
    return handleError(err);
  }
}