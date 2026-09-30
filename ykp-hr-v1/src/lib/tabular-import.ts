/**
 * Tabular file parsing for bulk import: CSV (koma ATAU titik-koma — Excel ID)
 * dan Excel .xlsx (read-excel-file). Dipakai route import karyawan.
 */

/** RFC-style CSV split berikut quoted multiline — delimiter koma ATAU titik-koma (Excel ID). */
export function csvToRows(text: string): Record<string, string>[] {
  const sample = text.slice(0, 2000).replace(/\r/g, '');
  const semi = (sample.match(/;/g) || []).length;
  const comma = (sample.match(/,/g) || []).length;
  const delim = comma >= semi ? ',' : ';';
  const records: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let inQuote = false;
  const pushCell = () => {
    cur.push(cell.trim());
    cell = '';
  };
  const pushRecord = () => {
    if (cur.length > 1 || (cur[0] && cur[0] !== '')) records.push(cur);
    cur = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      continue;
    }
    if (ch === delim) {
      pushCell();
      continue;
    }
    if (ch === '\n') {
      pushCell();
      pushRecord();
      continue;
    }
    if (ch === '\r') continue;
    cell += ch;
  }
  pushCell();
  pushRecord();
  return recordsToRecords(records);
}

/** Format nilai sel Excel → string: Date → YYYY-MM-DD, angka → string, null → ''. */
export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).trim();
}

/** Baris matriks (header + data) → array of objects keyed by header. */
export function recordsToRecords(records: unknown[][]): Record<string, string>[] {
  if (records.length < 2) return [];
  const headers = (records[0] ?? []).map((h) => cellToString(h).replace(/^\ufeff/, ''));
  return records.slice(1).map((values) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cellToString(values[i])));
    return row;
  });
}

/** True bila buffer diawali signature ZIP (xlsx adalah arsip zip). */
function looksLikeZip(buf: Uint8Array): boolean {
  return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

export function isXlsxName(name: string): boolean {
  return /\.(xlsx|xlsm)$/i.test(name);
}

/** Parse File (CSV atau .xlsx) menjadi baris-baris object siap impor. */
export async function parseTabularFile(file: File): Promise<Record<string, string>[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (isXlsxName(file.name) || looksLikeZip(buf)) {
    const { default: readXlsxFile } = await import('read-excel-file/node');
    const rows = (await readXlsxFile(Buffer.from(buf))) as unknown as unknown[][];
    return recordsToRecords(rows);
  }
  const text = new TextDecoder('utf-8').decode(buf);
  return csvToRows(text);
}