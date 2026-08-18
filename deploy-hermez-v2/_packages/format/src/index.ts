/**
 * @ykp/format — Indonesian-aware formatting helpers.
 *
 * Leaf package: depends only on @ykp/config (for TZ). Safe to import from
 * @ykp/engine and other pure-TS packages without pulling React/Tailwind.
 */

import { TZ } from "../../config/src/index";

/**
 * Format a number as Indonesian Rupiah: `Rp 1.234.567`.
 * Negative numbers render as `-Rp 1.234.567`.
 */
export function formatIdr(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  const grouped = abs
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}Rp ${grouped}`;
}

/** Parse an IDR-formatted string back into a number. */
export function parseIdr(s: string): number {
  const cleaned = s
    .replace(/\s+/g, "")
    .replace(/rp/i, "")
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/** Format a Date (or ISO string) as a WIB date-time (e.g. `07/07/2026 22:00 WIB`). */
export function formatDateWib(d: Date | string | number): string {
  const date = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

/** Current timestamp in WIB as a Date instance (preserves underlying UTC instant). */
export function nowWib(): Date {
  return new Date();
}

/** Convert a WIB naive datetime string (`YYYY-MM-DD HH:mm`) to a UTC Date. */
export function wibToUtc(input: string): Date {
  // Treat input as Asia/Jakarta local time and convert to UTC.
  const parsed = new Date(input.replace(" ", "T"));
  // Jakarta is UTC+7 year-round (no DST).
  const utcMs = parsed.getTime() - 7 * 60 * 60 * 1000;
  return new Date(utcMs);
}

/** Convert a UTC Date to a WIB-naive datetime string (`YYYY-MM-DD HH:mm`). */
export function utcToWib(d: Date): string {
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())} ` +
    `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}`
  );
}