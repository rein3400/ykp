/** WIB date/number formatting helpers (pure, unit-testable). */

export function todayWib(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** `2026-06-29` → `29 Jun 2026` (WIB calendar date, Hermez brief header format). */
export function formatDateShort(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`;
}

/** `2026-06-29 21:35:00` / ISO → `21:35`. Returns '' when unparseable. */
export function formatTimeHm(raw: string): string {
  if (!raw) return '';
  const m = /(\d{2}):(\d{2})/.exec(raw.replace('T', ' '));
  return m ? `${m[1]}:${m[2]}` : '';
}

/** 12450000 → `Rp12.450.000` */
export function idr(n: number): string {
  const neg = n < 0;
  const abs = Math.round(Math.abs(n));
  return `${neg ? '-' : ''}Rp${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** Signed variant: -25000 → `-Rp25.000` (kept explicit for cash-diff display). */
export function idrSigned(n: number): string {
  return n < 0 ? `-${idr(Math.abs(n))}` : idr(n);
}

/** Parse a sheet numeric cell; '' / undefined / NaN → 0. Handles id-ID grouping (`1.250.000`). */
export function num(v: string | undefined | null): number {
  if (!v) return 0;
  const s = String(v).trim();
  // Pure id-ID thousands grouping: dots separate 3-digit groups, no decimals.
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function sum(rows: Record<string, string>[], col: string): number {
  return rows.reduce((s, r) => s + num(r[col]), 0);
}
