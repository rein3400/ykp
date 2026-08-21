/**
 * One-off: create the telegram_link_codes tab + header row if missing.
 * Idempotent — safe to re-run.
 */
import { getSheetsClient, getSpreadsheetId, TAB_HEADERS, TABS, columnLetter } from '../src/db/sheets';

async function main() {
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const tab = TABS.telegramLinkCodes;
  const headers = TAB_HEADERS[tab];
  const lastCol = columnLetter(headers.length);

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === tab) ?? false;
  if (!exists) {
    console.log(`[create-tab] creating tab: ${tab}`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sid,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] }
    });
  } else {
    console.log(`[create-tab] tab already exists: ${tab}`);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: `${tab}!A1:${lastCol}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] }
  });
  console.log('[create-tab] header written:', headers.join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
