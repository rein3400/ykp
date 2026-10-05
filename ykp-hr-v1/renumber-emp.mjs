import { createRequire } from 'node:module';
const require = createRequire('/Users/developer/Development/Website/pribadi/ykp/ykp-hr-v1/package.json');
const { google } = require('googleapis');
import fs from 'node:fs';

function env(k) {
  const l = fs.readFileSync('/Users/developer/Development/Website/pribadi/ykp/.deploy.env', 'utf8').split('\n').find((x) => x.startsWith(k + '='));
  if (!l) throw new Error(k);
  let v = l.slice(k.length + 1).trim();
  if (v.startsWith('"')) v = v.slice(1, -1);
  else if (v.startsWith("'")) v = v.slice(1, -1);
  if (v.includes('\\n')) v = v.replaceAll('\\n', '\n');
  return v;
}

const auth = new google.auth.JWT({ email: env('GOOGLE_SERVICE_ACCOUNT_EMAIL'), key: env('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });
const sid = env('YKP_HR_SPREADSHEET_ID');

const csv = fs.readFileSync('/Users/developer/Downloads/karyawan-final-OL012.csv', 'utf8').split('\n').slice(1).filter((l) => l.trim());
const namesInOrder = csv.map((l) => l.split(',')[0].trim());

const raw3 = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: 'master_employee!A:C' });
const rows = (raw3.data.values || []).slice(1);

const updates = [];
for (let i = 0; i < rows.length; i++) {
  const [id, , name] = rows[i];
  if (!id || !id.startsWith('EMP-MUO4')) continue;
  const oi = namesInOrder.indexOf((name || '').trim());
  if (oi === -1) continue;
  const nn = 12 + oi;
  updates.push({ row: i + 2, newId: `EMP-${String(nn).padStart(3, '0')}`, name });
}

console.log('renumber:', updates.length, 'baris');
const data = updates.map((u) => ({ range: `master_employee!A${u.row}:B${u.row}`, values: [[u.newId, u.newId.replace('EMP-', 'K-')]] }));
await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: sid, range: 'master_employee!A1', valueInputOption: 'RAW', requestBody: { valueInputOption: 'RAW', data } });
console.log('selesai');
for (const u of updates.slice(0, 3)) console.log(' ', u.newId, '-', u.name);
console.log('  ...', updates[updates.length - 1]?.newId, '-', updates[updates.length - 1]?.name);