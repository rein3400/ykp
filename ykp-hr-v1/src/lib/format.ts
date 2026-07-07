/**
 * IDR + WIB formatting helpers. Money is integer Rupiah (no decimals, no Rp prefix).
 * Display: formatIdr(n) -> "Rp 1.234.567" (space after Rp).
 * Date: formatDateWib -> "2026-07-06" (Asia/Jakarta).
 */

export function formatIdr(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '';
  const sign = num < 0 ? '-' : '';
  return `${sign}Rp ${Math.abs(Math.trunc(num)).toLocaleString('id-ID')}`;
}

export function parseIdr(s: string): number {
  const cleaned = s.replace(/[^\d-]/g, '');
  return cleaned === '' ? 0 : Number(cleaned);
}

/** WIB date string "YYYY-MM-DD" from a Date. Uses Intl to avoid tz drift. */
export function formatDateWib(d: Date | string | number = new Date()): string {
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/** WIB timestamp "YYYY-MM-DD HH:mm:ss". */
export function formatTimestampWib(d: Date | string | number = new Date()): string {
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/** WIB time "HH:mm". */
export function formatTimeWib(d: Date | string | number = new Date()): string {
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

export function todayWib(): string {
  return formatDateWib(new Date());
}

export function nowTimestampWib(): string {
  return formatTimestampWib(new Date());
}