/**
 * Bootstrap: create all Operational V1 tabs with header rows.
 *   npm run sheets:bootstrap
 */
import { google } from 'googleapis';
import { TAB_HEADERS } from '../src/db/sheets';

async function main() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const spreadsheetId = process.env.YKP_OPS_SPREADSHEET_ID;
  if (!email || !key || !spreadsheetId) {
    console.error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL, PRIVATE_KEY, or YKP_OPS_SPREADSHEET_ID');
    process.exit(1);
  }
  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const existing = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set(existing.data.sheets?.map((s) => s.properties?.title) ?? []);

  for (const [tab, headers] of Object.entries(TAB_HEADERS)) {
    if (!existingTitles.has(tab)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
      });
      console.log(`+ sheet ${tab}`);
    }
    const endCol = columnLetter(headers.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1:${endCol}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
    console.log(`  headers ${tab}: ${headers.length} cols`);
  }
  console.log('Operational sheets bootstrap OK');
}

function columnLetter(n: number): string {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s || 'A';
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
