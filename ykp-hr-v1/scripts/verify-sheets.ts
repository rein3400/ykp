/** Quick verify: count rows per tab in production spreadsheet. */
import { getSheetsClient, getSpreadsheetId, TABS, readTab } from '../src/db/sheets';

async function main() {
  process.env.USE_MOCK_DB = 'false';
  getSheetsClient();
  const sid = getSpreadsheetId();
  console.log('spreadsheet', sid);
  for (const [name, tab] of Object.entries(TABS)) {
    try {
      const rows = await readTab(tab as never);
      console.log(`${name}: ${rows.length}`);
    } catch (e) {
      console.log(`${name}: ERROR ${String(e)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
