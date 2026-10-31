export type ReportKind =
  | "opening"
  | "closing"
  | "checklist"
  | "incident"
  | "complaint"
  | "waste"
  | "stock"
  | "qc"
  | "kds"
  | "briefing";
export interface Field {
  key: string;
  label: string;
  type: "text" | "number" | "score" | "severity" | "seconds";
}
export function menuKeyboard() {
  return {
    keyboard: [
      ["Opening Checklist", "Closing Checklist"],
      ["Checklist Operasional", "Incident"],
      ["Complaint", "Waste"],
      ["Stock Issue", "Visual QC"],
      ["KDS", "Briefing"],
      ["/menu", "/batal"],
    ],
    resize_keyboard: true,
  };
}
export function reportKind(text: string): ReportKind | null {
  const value = text.trim().toLowerCase().replace(/@\w+$/, "");
  const names: Record<string, ReportKind> = {
    "/opening": "opening",
    "opening checklist": "opening",
    "/closing": "closing",
    "closing checklist": "closing",
    "/checklist": "checklist",
    "checklist operasional": "checklist",
    "/insiden": "incident",
    "/incident": "incident",
    incident: "incident",
    "/complaint": "complaint",
    complaint: "complaint",
    "/waste": "waste",
    waste: "waste",
    "/stock": "stock",
    "stock issue": "stock",
    "/qc": "qc",
    "visual qc": "qc",
    "/kds": "kds",
    kds: "kds",
    "/briefing": "briefing",
    briefing: "briefing",
  };
  return names[value] ?? null;
}
export function reportFields(kind: ReportKind): Field[] {
  if (kind === "incident" || kind === "complaint")
    return [
      {
        key: "title",
        label: "Judul kejadian (maksimal 200 karakter)",
        type: "text",
      },
      { key: "description", label: "Jelaskan kejadian/keluhan", type: "text" },
      {
        key: "severity",
        label: "Tingkat dampak: LOW, MEDIUM, HIGH atau CRITICAL",
        type: "severity",
      },
    ];
  if (kind === "waste")
    return [
      {
        key: "ingredient_name",
        label: "Nama bahan yang terbuang",
        type: "text",
      },
      { key: "qty", label: "Jumlah waste (angka positif)", type: "number" },
      {
        key: "unit",
        label: "Satuan waste, misalnya g, ml atau pc",
        type: "text",
      },
      { key: "reason", label: "Alasan waste", type: "text" },
    ];
  if (kind === "stock")
    return [
      {
        key: "ingredient_id",
        label: "Kode atau nama bahan bermasalah",
        type: "text",
      },
      {
        key: "expected_qty",
        label: "Jumlah stok menurut catatan (nol diperbolehkan)",
        type: "seconds",
      },
      {
        key: "actual_qty",
        label: "Jumlah stok fisik (nol diperbolehkan)",
        type: "seconds",
      },
      {
        key: "reason",
        label: "Jelaskan masalah stok dan satuannya",
        type: "text",
      },
    ];
  if (kind === "qc")
    return [
      {
        key: "product_name",
        label: "Nama produk yang diperiksa",
        type: "text",
      },
      { key: "score", label: "Nilai Visual QC 0 sampai 5", type: "score" },
      { key: "notes", label: "Catatan hasil pemeriksaan", type: "text" },
    ];
  if (kind === "kds")
    return [
      {
        key: "menu_items",
        label: "Nomor pesanan dan menu yang dilayani",
        type: "text",
      },
      {
        key: "serving_seconds",
        label: "Waktu pelayanan aktual dalam detik",
        type: "seconds",
      },
      {
        key: "target_seconds",
        label: "Target waktu pelayanan dalam detik",
        type: "number",
      },
      { key: "notes", label: "Catatan pelayanan", type: "text" },
    ];
  return [];
}
export function parseField(field: Field, raw: string): string {
  const value = raw.trim();
  if (!value || value.length > 2000)
    throw new Error("Isi wajib 1–2.000 karakter");
  if (field.type === "text") {
    if (field.key === "title" && value.length > 200)
      throw new Error("Judul maksimal 200 karakter");
    return value;
  }
  if (field.type === "severity") {
    const v = value.toUpperCase();
    if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(v))
      throw new Error("Pilih LOW/MEDIUM/HIGH/CRITICAL");
    return v;
  }
  const n = Number(value.replace(",", "."));
  if (
    !Number.isFinite(n) ||
    n < 0 ||
    (field.type === "number" && n === 0) ||
    (field.type === "score" && n > 5)
  )
    throw new Error("Angka di luar batas yang diperbolehkan");
  return String(n);
}
export function escapeTelegram(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
