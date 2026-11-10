export const MASTER_ACTIONS = {
  items: {
    key: "item_id",
    resource: "item",
    fields: [
      "item_name",
      "item_code",
      "category_id",
      "item_type",
      "preferred_supplier_id",
      "backup_supplier_id",
      "minimum_stock",
      "safety_stock",
      "maximum_stock",
      "reorder_point",
      "minimum_order_quantity",
      "supplier_lead_time_days",
      "criticality",
    ],
    locked: [
      "brand_id",
      "base_unit",
      "purchase_unit",
      "conversion_factor",
      "pack_size",
    ],
  },
  categories: {
    key: "category_id",
    resource: "category",
    fields: ["category_name"],
    locked: ["parent_category_id"],
  },
  suppliers: {
    key: "supplier_id",
    resource: "supplier",
    fields: [
      "supplier_code",
      "supplier_name",
      "phone",
      "email",
      "address",
      "bank_name",
      "bank_account",
      "account_holder",
      "lead_time_days",
      "minimum_order_value",
      "preferred_delivery_day",
    ],
    locked: [],
  },
  locations: {
    key: "location_id",
    resource: "location",
    fields: ["location_name", "location_code", "address"],
    locked: ["brand_id", "outlet_id", "location_type", "parent_location_id"],
  },
  "unit-conversion": {
    key: "conversion_id",
    resource: "unit_conversion",
    fields: [],
    locked: ["item_id", "from_unit", "to_unit", "conversion_factor"],
  },
  threshold: {
    key: "threshold_id",
    resource: "threshold",
    fields: [
      "warning_value",
      "high_value",
      "critical_value",
      "notify_recipient",
    ],
    locked: [
      "item_id",
      "brand_id",
      "outlet_id",
      "location_id",
      "threshold_type",
      "unit",
    ],
  },
} as const;
export type MasterKind = keyof typeof MASTER_ACTIONS;
export function masterKind(value: string): value is MasterKind {
  return Object.hasOwn(MASTER_ACTIONS, value);
}
const numeric = new Set([
  "minimum_stock",
  "safety_stock",
  "maximum_stock",
  "reorder_point",
  "minimum_order_quantity",
  "supplier_lead_time_days",
  "lead_time_days",
  "minimum_order_value",
  "preferred_delivery_day",
  "warning_value",
  "high_value",
  "critical_value",
]);
export function validateMasterPatch(
  kind: MasterKind,
  body: unknown,
  existing: Record<string, string>,
): Record<string, string> {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Form tidak valid");
  const rule = MASTER_ACTIONS[kind];
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if ((rule.locked as readonly string[]).includes(key)) {
      if (typeof value !== "string" || value !== existing[key])
        throw new Error(
          `Kolom ${key} dikunci untuk menjaga riwayat. Buat master pengganti bila perlu.`,
        );
      continue;
    }
    if (!(rule.fields as readonly string[]).includes(key))
      throw new Error(`Kolom tidak dapat diedit: ${key}`);
    if (typeof value !== "string" || value.length > 2000)
      throw new Error("Nilai harus berupa teks maksimal 2.000 karakter");
    const text = value.trim();
    if (key.endsWith("_name") && !text) throw new Error("Nama wajib diisi");
    if (
      numeric.has(key) &&
      text &&
      (!Number.isFinite(Number(text)) || Number(text) < 0)
    )
      throw new Error(`Angka ${key} tidak valid`);
    if (
      key === "minimum_order_value" &&
      text &&
      !Number.isSafeInteger(Number(text))
    )
      throw new Error("Nilai uang wajib integer IDR");
    if (
      key === "preferred_delivery_day" &&
      text &&
      (!Number.isInteger(Number(text)) || Number(text) < 1 || Number(text) > 7)
    )
      throw new Error("Hari harus 1–7");
    if (key === "email" && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
      throw new Error("Email tidak valid");
    if (
      key === "criticality" &&
      !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(text)
    )
      throw new Error("Criticality tidak valid");
    if (
      key === "item_type" &&
      ![
        "RAW_MATERIAL",
        "PACKAGING",
        "FINISHED_GOOD",
        "SEMI_FINISHED",
        "CLEANING_SUPPLY",
        "EQUIPMENT_CONSUMABLE",
        "OTHER",
      ].includes(text)
    )
      throw new Error("Tipe item tidak valid");
    if (
      key === "notify_recipient" &&
      text &&
      !/^(?:user|role|dept|hod):[\w-]+$/.test(text) &&
      !/^\d{5,15}$/.test(text)
    )
      throw new Error("Recipient tidak valid");
    result[key] = text;
  }
  const merged = { ...existing, ...result };
  if (
    kind === "items" &&
    merged.minimum_stock &&
    merged.maximum_stock &&
    Number(merged.minimum_stock) > Number(merged.maximum_stock)
  )
    throw new Error("Stok minimum tidak boleh melebihi maksimum");
  if (
    kind === "threshold" &&
    merged.warning_value &&
    merged.high_value &&
    Number(merged.warning_value) > Number(merged.high_value)
  )
    throw new Error("Warning tidak boleh melebihi high");
  return result;
}
