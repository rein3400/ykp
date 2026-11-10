import { getSession } from "@/lib/session";
import { can, type Role, type Resource } from "@/lib/rbac";
import { readTab, TABS, type TabName } from "@/db/sheets";
import {
  handler,
  ok,
  badRequest,
  forbidden,
  notFound,
  unauthorized,
  conflict,
} from "@/lib/http";
import {
  MASTER_ACTIONS,
  masterKind,
  validateMasterPatch,
  type MasterKind,
} from "@/lib/master-actions";
import { masterReferences, saveMasterRow } from "@/lib/master-store";
import { logAudit } from "@/lib/audit";
import { nowTimestampWib } from "@/lib/format";
const tables: Record<MasterKind, TabName> = {
  items: TABS.items,
  categories: TABS.itemCategory,
  suppliers: TABS.suppliers,
  locations: TABS.locations,
  "unit-conversion": TABS.unitConversion,
  threshold: TABS.inventoryThreshold,
};
const identity: Record<MasterKind, string> = {
  items: "item_id",
  categories: "category_id",
  suppliers: "supplier_id",
  locations: "location_id",
  "unit-conversion": "conversion_id",
  threshold: "threshold_id",
};
async function mutate(
  request: Request,
  params: Record<string, string>,
  archive: boolean,
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!masterKind(params.kind)) return notFound("Master tidak ditemukan");
  const kind = params.kind,
    rule = MASTER_ACTIONS[kind];
  if (
    !can(
      session.role as Role,
      archive ? "delete" : "update",
      rule.resource as Resource,
    )
  )
    return forbidden();
  const rows = await readTab<Record<string, string>>(tables[kind]);
  const matches = rows.filter((r) => r[rule.key] === params.id);
  if (matches.length !== 1)
    return conflict("Master hilang atau memiliki ID duplikat; hubungi admin");
  const before = matches[0];
  if (
    (session.brandId &&
      before.brand_id &&
      before.brand_id !== session.brandId) ||
    (session.outletId &&
      before.outlet_id &&
      before.outlet_id !== session.outletId)
  )
    return forbidden();
  let patch: Record<string, string>;
  if (archive) {
    if (before.active_status === "inactive") return ok(before);
    if (!["unit-conversion", "threshold"].includes(kind)) {
      const blocked: string[] = [];
      const referenceData = await masterReferences(
        Object.values(TABS).filter(
          (tab) =>
            ![TABS.auditLog, TABS.attachments].includes(
              tab as typeof TABS.auditLog,
            ),
        ),
      );
      for (const { tab, rows: data } of referenceData) {
        const references = data.some((row) => {
          if (tab === tables[kind] && row[rule.key] === params.id) return false;
          const refKeys =
            kind === "items"
              ? ["item_id"]
              : kind === "suppliers"
                ? ["supplier_id", "preferred_supplier_id", "backup_supplier_id"]
                : kind === "categories"
                  ? ["category_id", "parent_category_id"]
                  : [
                      "location_id",
                      "source_location_id",
                      "destination_location_id",
                      "parent_location_id",
                    ];
          return refKeys.some((key) => row[key] === params.id);
        });
        if (references) blocked.push(tab);
      }
      if (blocked.length)
        return conflict(
          `Belum dapat diarsipkan karena direferensikan: ${blocked.join(", ")}. Riwayat tidak dihapus.`,
        );
    }
    patch = { active_status: "inactive" };
  } else {
    if (before.active_status === "inactive")
      return conflict("Master sudah diarsipkan dan tidak dapat diedit");
    try {
      patch = validateMasterPatch(
        kind,
        await request.json().catch(() => null),
        before,
      );
    } catch (error) {
      return badRequest(
        error instanceof Error ? error.message : "Form tidak valid",
      );
    }
    for (const [field, target, key] of [
      ["category_id", TABS.itemCategory, "category_id"],
      ["preferred_supplier_id", TABS.suppliers, "supplier_id"],
      ["backup_supplier_id", TABS.suppliers, "supplier_id"],
    ] as const) {
      if (
        patch[field] &&
        !(await readTab<Record<string, string>>(target)).some(
          (row) => row[key] === patch[field] && row.active_status === "active",
        )
      )
        return badRequest(`Referensi ${field} tidak aktif/valid`);
    }
  }
  const updated = { ...before, ...patch };
  if ("updated_at" in before) updated.updated_at = nowTimestampWib();
  if ("updated_by" in before) updated.updated_by = session.userId;
  await saveMasterRow(tables[kind], identity[kind], params.id, before, updated);
  await logAudit({
    module: "warehouse",
    action: archive ? "archive" : "update",
    recordType: rule.resource,
    recordId: params.id,
    beforeValue: JSON.stringify(before),
    afterValue: JSON.stringify(updated),
    userId: session.userId,
  });
  return ok(updated);
}
export const PUT = handler(async (request, { params }) =>
  mutate(request, params, false),
);
export const DELETE = handler(async (request, { params }) =>
  mutate(request, params, true),
);
