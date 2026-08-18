/**
 * Lightweight WIB helpers for client code. Re-implements @ykp/ui's
 * todayWib here to avoid coupling client code to the SSR-only module.
 */
export function todayWib(): string {
  const d = new Date();
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}`;
}