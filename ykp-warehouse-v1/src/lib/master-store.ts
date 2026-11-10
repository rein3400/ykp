import {
  getSheetsClient,
  getSpreadsheetId,
  invalidateReadCache,
  readTab,
  TAB_HEADERS,
  type TabName,
} from "@/db/sheets";
import { isMockMode } from "@/db/mock-store";
import { isPostgresMode, pgUpdateRow } from "@/db/postgres";
import { mockUpdateRow } from "@/db/mock-store";

export async function masterReferences(
  tabs: TabName[],
): Promise<{ tab: TabName; rows: Record<string, string>[] }[]> {
  if (isMockMode() || isPostgresMode())
    return Promise.all(
      tabs.map(async (tab) => ({
        tab,
        rows: await readTab<Record<string, string>>(tab),
      })),
    );
  const response = await getSheetsClient().spreadsheets.values.batchGet({
    spreadsheetId: getSpreadsheetId(),
    ranges: tabs.map((tab) => `'${tab}'!A:ZZ`),
  });
  return tabs.map((tab, index) => {
    const [headers = [], ...rows] =
      response.data.valueRanges?.[index].values ?? [];
    return {
      tab,
      rows: rows.map((row) =>
        Object.fromEntries(headers.map((h, i) => [h, String(row[i] ?? "")])),
      ),
    };
  });
}

export async function saveMasterRow(
  tab: TabName,
  key: string,
  id: string,
  before: Record<string, string>,
  after: Record<string, string>,
): Promise<void> {
  if (isMockMode() || isPostgresMode()) {
    const rows = await readTab<Record<string, string>>(tab);
    const matches = rows
      .map((row, i) => ({ row, i }))
      .filter((x) => x.row[key] === id);
    if (matches.length !== 1)
      throw new Error("Identitas master hilang/duplikat");
    if (JSON.stringify(matches[0].row) !== JSON.stringify(before))
      throw new Error("Data berubah; refresh sebelum menyimpan");
    if (isMockMode()) {
      mockUpdateRow(tab, matches[0].i + 2, after);
      return;
    }
    const { pgFindRow } = await import("@/db/postgres");
    const found = await pgFindRow(tab, TAB_HEADERS[tab], key, id);
    if (!found) throw new Error("Master hilang");
    await pgUpdateRow(tab, TAB_HEADERS[tab], found.rowNumber, after);
    return;
  }
  const sheets = getSheetsClient(),
    spreadsheetId = getSpreadsheetId();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A:ZZ`,
  });
  const [headers = [], ...rows] = response.data.values ?? [];
  if (!headers.includes(key) || new Set(headers).size !== headers.length)
    throw new Error("Header master tidak valid; hubungi admin");
  const matches = rows
    .map((row, index) => ({ index, row }))
    .filter((x) => x.row[headers.indexOf(key)] === id);
  if (matches.length !== 1) throw new Error("Identitas master hilang/duplikat");
  const match = matches[0];
  const fresh = Object.fromEntries(
    headers.map((h, i) => [h, String(match.row[i] ?? "")]),
  );
  if (
    Object.keys(before).some(
      (h) => String(before[h] ?? "") !== String(fresh[h] ?? ""),
    )
  )
    throw new Error("Data berubah; refresh sebelum menyimpan");
  if (
    Object.keys(after).some(
      (h) => !headers.includes(h) && String(after[h] ?? "") !== "",
    )
  )
    throw new Error(
      "Schema master belum mendukung kolom perubahan; hubungi admin",
    );
  invalidateReadCache();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab}'!A${match.index + 2}`,
    valueInputOption: "RAW",
    requestBody: { values: [headers.map((h) => after[h] ?? fresh[h] ?? "")] },
  });
}
