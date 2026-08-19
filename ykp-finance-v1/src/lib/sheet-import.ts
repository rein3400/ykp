/**
 * Google Sheets import source (Finance).
 *
 * The owner's Moka data often lives in a spreadsheet, not a raw CSV file.
 * This module resolves a shared/viewable Google Sheets URL to the raw values
 * of its first tab, then re-renders them as an RFC 4180 CSV string so the
 * existing Moka importer stays untouched.
 *
 * Supports these URL forms:
 *   https://docs.google.com/spreadsheets/d/<ID>/edit#gid=...
 *   https://docs.google.com/spreadsheets/d/<ID>/export?format=csv
 *   https://docs.google.com/spreadsheets/d/<ID>/edit?usp=sharing
 */
import { getSheetsClient } from '@/db/sheets';

const SHEET_ID_RE = /\/spreadsheets\/d\/([A-Za-z0-9_-]+)/;
const GID_RE = /[#?&]gid=(\d+)/;

export interface SheetSource {
  spreadsheetId: string;
  gid?: string;
}

/** Extract the spreadsheet id + optional gid from a Google Sheets URL. */
export function extractSheetSource(url: string): SheetSource | null {
  const id = SHEET_ID_RE.exec(url)?.[1];
  if (!id) return null;
  const gid = GID_RE.exec(url)?.[1];
  return gid ? { spreadsheetId: id, gid } : { spreadsheetId: id };
}

/** Convert a tab gid to a sheet title so we can read it by name. */
export async function resolveSheetTitle(
  spreadsheetId: string,
  gid?: string
): Promise<string | null> {
  if (!gid) return null; // default to first tab when caller passes null title
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const found = meta.data.sheets?.find((s) => String(s.properties?.sheetId) === gid);
  return found?.properties?.title ?? null;
}

/** Quote a tab name for an A1 range (only when needed). */
function quoteTab(tab: string): string {
  return /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${tab}'`;
}

/** Escape a CSV cell per RFC 4180. */
export function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Convert a Sheets values grid to RFC 4180 CSV text. Pure — testable without
 * Google credentials. Blank rows are dropped.
 */
export function valuesToCsv(rows: unknown[][]): string {
  return rows
    .filter((row) => row.some((cell) => (cell ?? '') !== ''))
    .map((row) => row.map((cell) => csvEscape(cell)).join(','))
    .join('\n');
}

/**
 * Fetch the first tab of a public/readable spreadsheet (or a gid-specific
 * tab) and return it as CSV text for the Moka importer.
 */
export async function fetchSheetCsv(url: string): Promise<{ csv: string; title: string }> {
  const source = extractSheetSource(url);
  if (!source) throw new Error('URL Google Sheets tidak valid');

  const sheets = getSheetsClient();
  const title = source.gid ? await resolveSheetTitle(source.spreadsheetId, source.gid) : null;

  const range = title ? `${quoteTab(title)}!A1:ZZ1000` : 'A1:ZZ1000';
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: source.spreadsheetId,
    range,
    valueRenderOption: 'FORMATTED_VALUE'
  });
  const rows = res.data.values ?? [];
  return { csv: valuesToCsv(rows), title: title ?? '' };
}
