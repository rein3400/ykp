/**
 * CSV export helpers. Produces RFC 4180 CSV with UTF-8 BOM so Excel opens
 * Indonesian text (Rp, names) correctly. Pure — no I/O.
 */

/** Escape a CSV field per RFC 4180 (quote if contains comma/quote/newline). */
export function csvEscape(v: string | number | undefined | null): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from headers + rows. Prepends UTF-8 BOM for Excel. */
export function toCsv(headers: string[], rows: Record<string, string | number | undefined | null>[]): string {
  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(','));
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

/** Build a CSV string from a raw 2D array (for templates). */
export function toCsvRaw(rows: (string | number)[][]): string {
  const lines = rows.map((r) => r.map(csvEscape).join(','));
  return '\uFEFF' + lines.join('\r\n');
}
