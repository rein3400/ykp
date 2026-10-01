// Idempotent HR Sheets migration: align master_brand to the application schema
// (adds the `email` sender column used by payslip delivery). Existing rows are
// remapped by header name; no brand values are dropped or invented.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const { google } = require('googleapis');

function env(k) {
  const line = fs.readFileSync(new URL('../../.deploy.env', import.meta.url), 'utf8').split('\n').find((x) => x.startsWith(k + '='));
  if (!line) throw new Error(`${k} missing from .deploy.env`);
  let value = line.slice(k.length + 1).trim();
  if (value.startsWith('"')) value = value.slice(1, -1); else if (value.startsWith("'")) value = value.slice(1, -1);
  return value.replaceAll('\\n', '\n');
}
function columnLetter(n) { let out = ''; while (n > 0) { out = String.fromCharCode(65 + ((n - 1) % 26)) + out; n = Math.floor((n - 1) / 26); } return out; }

const source = fs.readFileSync(new URL('../src/db/sheets.ts', import.meta.url), 'utf8');
const block = source.match(/\[TABS\.brands\]:\s*\[([\s\S]*?)\]/);
if (!block) throw new Error('TABS.brands schema not found');
const canonical = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

const auth = new google.auth.JWT({ email: env('GOOGLE_SERVICE_ACCOUNT_EMAIL'), key: env('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = env('YKP_HR_SPREADSHEET_ID');
const meta = (await sheets.spreadsheets.get({ spreadsheetId, ranges: ['master_brand'] })).data;
const sheet = meta.sheets?.find((x) => x.properties.title === 'master_brand')?.properties;
if (!sheet) throw new Error('master_brand tab missing');
const values = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'master_brand!A1:AZ' });
const rows = values.data.values ?? [];
const liveHeader = rows[0] ?? [];
if (JSON.stringify(liveHeader) === JSON.stringify(canonical)) {
  console.log('master_brand already aligned (skip)');
} else {
  const oldIndex = new Map(liveHeader.map((name, index) => [name, index]));
  const normalized = [canonical];
  for (const row of rows.slice(1)) {
    if (!String(row[oldIndex.get('brand_id') ?? -1] ?? '').trim()) continue;
    normalized.push(canonical.map((key) => { const index = oldIndex.get(key); return index === undefined ? '' : (row[index] ?? ''); }));
  }
  if (canonical.length > (sheet.gridProperties?.columnCount ?? 0)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ appendDimension: { sheetId: sheet.sheetId, dimension: 'COLUMNS', length: canonical.length - (sheet.gridProperties?.columnCount ?? 0) } }] } });
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `master_brand!A1:${columnLetter(canonical.length)}${normalized.length}`,
    valueInputOption: 'RAW',
    requestBody: { values: normalized }
  });
  console.log(`master_brand aligned: ${liveHeader.length} → ${canonical.length} columns; preserved ${normalized.length - 1} brand rows.`);
}
