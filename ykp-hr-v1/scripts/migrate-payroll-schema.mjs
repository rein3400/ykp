// Idempotently align hr_payroll columns to the application schema by header name.
// Existing rows are mapped to canonical headers before writing; no payroll values
// are discarded when legacy headers differ in order or are missing columns.
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
function colLetter(n) { let out = ''; while (n > 0) { out = String.fromCharCode(65 + ((n - 1) % 26)) + out; n = Math.floor((n - 1) / 26); } return out; }

const source = fs.readFileSync(new URL('../src/db/sheets.ts', import.meta.url), 'utf8');
const block = source.match(/\[TABS\.payroll\]:\s*\[([\s\S]*?)\]/);
if (!block) throw new Error('TABS.payroll schema not found');
const canonical = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
if (!canonical.includes('incentive_total')) throw new Error('incentive_total missing in code schema');

const auth = new google.auth.JWT({ email: env('GOOGLE_SERVICE_ACCOUNT_EMAIL'), key: env('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = env('YKP_HR_SPREADSHEET_ID');
const meta = (await sheets.spreadsheets.get({ spreadsheetId, ranges: ['hr_payroll'] })).data;
const sheet = meta.sheets?.find((x) => x.properties.title === 'hr_payroll')?.properties;
if (!sheet) throw new Error('hr_payroll tab missing');
const values = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'hr_payroll!A1:AZ' });
const rows = values.data.values ?? [];
const oldHeader = rows[0] ?? [];
const oldCount = Math.max(0, rows.length - 1);
const oldIndex = new Map(oldHeader.map((name, index) => [name, index]));
const normalized = [canonical];
for (const row of rows.slice(1)) {
  normalized.push(canonical.map((key) => {
    const index = oldIndex.get(key);
    return index === undefined ? '' : (row[index] ?? '');
  }));
}
if (canonical.length > (sheet.gridProperties?.columnCount ?? 0)) {
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ appendDimension: { sheetId: sheet.sheetId, dimension: 'COLUMNS', length: canonical.length - (sheet.gridProperties?.columnCount ?? 0) } }] } });
}
const endCol = colLetter(canonical.length);
await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: `hr_payroll!A1:${endCol}${normalized.length}`,
  valueInputOption: 'RAW',
  requestBody: { values: normalized }
});
console.log(`hr_payroll aligned: ${oldHeader.length} → ${canonical.length} columns; preserved ${oldCount} data rows.`);
