export function expenseQuantity(value: unknown): string {
  if (value === undefined || value === "") return "";
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !Number.isFinite(Number(value)) ||
    Number(value) <= 0
  )
    throw new Error("Qty wajib angka positif atau kosong");
  return String(Number(value));
}
