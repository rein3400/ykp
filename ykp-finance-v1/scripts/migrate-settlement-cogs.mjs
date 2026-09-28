// One-off migration (idempotent): append settlement + cogs header columns to
// the live finance spreadsheet tabs (fin_pos_items, fin_daily_summary).
// Run: node scripts/migrate-settlement-cogs.mjs  (creds dari ../.deploy.env)
import fs from 'node:fs';
import { google } from 'googleapis';

function env(k) {
  const line = fs.readFileSync(new URL('../../.deploy.env', import.meta.url), 'utf8')
    .split('\n').find((l) => l.startsWith(k + '='));
  if (!line) throw new Error(k + ' tidak ada di .deploy.env');
  let v = line.slice(k.length + 1).trim();
  if (v.startsWith('"')) v = v.slice(1, -1);
  else if (v.startsWith("'")) v = v.slice(1, -1);
  if (v.includes('\\n')) v = v.replaceAll('\\n', '\n');
  return v;
}

const auth = new google.auth.JWT({
  email: env('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
  key: env('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
const sid = env('YKP_FINANCE_SPREADSHEET_ID');

const PLAN = [
  ['fin_pos_items', ['cogs', 'gross_profit']],
  ['fin_daily_summary', ['settle_cash', 'settle_qris', 'settle_card', 'settle_transfer', 'settle_marketplace', 'total_settlement', 'cogs', 'gross_profit', 'cogs_coverage']]
];

for (const [tab, newCols] of PLAN) {
  const cur = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: `${tab}!1:1` });
  const header = cur.data.values?.[0] ?? [];
  const missing = newCols.filter((c) => !header.includes(c));
  if (missing.length === 0) {
    console.log(`${tab}: semua kolom sudah ada (skip)`);
    continue;
  }
  const meta = (await sheets.spreadsheets.get({ spreadsheetId: sid, ranges: [tab] })).data;
  const grid = meta.sheets?.[0].properties;
  if (grid && header.length + missing.length > (grid.gridProperties?.columnCount ?? 0)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sid,
      requestBody: {
        requests: [{
          appendDimension: {
            sheetId: grid.sheetId,
            dimension: 'COLUMNS',
            length: header.length + missing.length - (grid.gridProperties?.columnCount ?? 0)
          }
        }]
      }
    });
  }
  const startCol = header.length; // 0-based offset → kolom append = startCol+1
  let n = startCol + 1, col = '';
  while (n > 0) { col = String.fromCharCode(65 + ((n - 1) % 26)) + col; n = Math.floor((n - 1) / 26); }
  await sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: `${tab}!${col}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [missing] }
  });
  console.log(`${tab}: tambah ${missing.length} kolom (${missing.join(', ')}) di ${col}1+`);
}
console.log('migrasi header selesai.');