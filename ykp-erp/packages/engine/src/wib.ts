/**
 * Pure timezone helpers — no Node-only deps, safe for client bundles.
 */

/** Format Date as WIB ISO-like string with explicit +07:00 offset. */
export function nowWibIso(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}+07:00`;
}

/** Returns today's date in Asia/Jakarta as YYYY-MM-DD. */
export function todayWib(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}