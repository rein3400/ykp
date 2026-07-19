/**
 * IDR + WIB formatting helpers. Money is integer Rupiah (no decimals, no Rp prefix).
 * Display: formatIdr(n) -> "Rp 1.234.567".
 */
export function formatIdr(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '';
  const sign = num < 0 ? '-' : '';
  return `${sign}Rp ${Math.abs(Math.trunc(num)).toLocaleString('id-ID')}`;
}

/** Signed variant: always shows + / - (for cash difference, surplus). */
export function formatIdrSigned(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '';
  if (num > 0) return `+${formatIdr(num)}`;
  return formatIdr(num);
}

export function parseIdr(s: string): number {
  const cleaned = s.replace(/[^\d-]/g, '');
  return cleaned === '' ? 0 : Number(cleaned);
}

export function formatDateWib(d: Date | string | number = new Date()): string {
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export function formatTimestampWib(d: Date | string | number = new Date()): string {
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export function formatTimeWib(d: Date | string | number = new Date()): string {
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);
}

export function todayWib(): string {
  return formatDateWib(new Date());
}

export function nowTimestampWib(): string {
  return formatTimestampWib(new Date());
}

/** "2026-07" → "Juli 2026" (Bahasa Indonesia month label). */
export function monthLabelId(yyyyMm: string): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const [y, m] = yyyyMm.split('-');
  const idx = Number(m) - 1;
  return idx >= 0 && idx < 12 ? `${months[idx]} ${y}` : yyyyMm;
}

/** "2026-07-18" → "18 Jul 2026" short label. */
export function dateLabelId(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const [y, m, d] = dateStr.split('-');
  const idx = Number(m) - 1;
  return idx >= 0 && idx < 12 ? `${Number(d)} ${months[idx]} ${y}` : dateStr;
}
