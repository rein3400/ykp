// Migrasi live-sheets untuk merge feat/payroll-moka-checklist:
//  1. tab baru finance_moka_auth (13 header — TABS.mokaAuth)
//  2. master_brand: tambah kolom 'email'
//  3. finance_audit_log: tambah kolom 'chain_hash'
// Idempotent. Run: node scripts/migrate-payroll-moka-checklist.mjs
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

function colLetter(n) { let s = ''; while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); } return s; }

const auth = new google.auth.JWT({
  email: env('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
  key: env('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
const sid = env('YKP_FINANCE_SPREADSHEET_ID');

async function ensureGrid(tab, len, sheetId) {
  const meta = (await sheets.spreadsheets.get({ spreadsheetId: sid, ranges: [tab] })).data;
  const cur = meta.sheets?.[0].properties.gridProperties?.columnCount ?? 0;
  if (len > cur) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: sid, requestBody: { requests: [{ appendDimension: { sheetId, dimension: 'COLUMNS', length: len - cur } }] } });
  }
  return { sheetId: meta.sheets?.[0].properties.sheetId, colCount: cur };
}

async function appendHeader(tab, newCols, sheetId, curCount) {
  const cur = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: `${tab}!1:1` });
  const header = cur.data.values?.[0] ?? [];
  const missing = newCols.filter((c) => !header.includes(c));
  if (missing.length === 0) { console.log(`${tab}: kolom sudah ada (skip)`); return; }
  await ensureGrid(tab, header.length + missing.length, sheetId);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: `${tab}!${colLetter(header.length + 1)}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [missing] }
  });
  console.log(`${tab}: +${missing.length} kolom (${missing.join(', ')})`);
}

// 1) tab finance_moka_auth
const titles = new Set((await sheets.spreadsheets.get({ spreadsheetId: sid })).data.sheets.map((s) => s.properties.title));
if (!titles.has('finance_moka_auth')) {
  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sid,
    requestBody: { requests: [{ addSheet: { properties: { title: 'finance_moka_auth', gridProperties: { rowCount: 1000, columnCount: 13 } } } }] }
  });
  const sheetId = res.data.replies?.[0].addSheet?.properties.sheetId;
  await sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: 'finance_moka_auth!A1:M1',
    valueInputOption: 'RAW',
    requestBody: { values: [['id', 'merchant_id', 'merchant_name', 'business_id', 'outlet_ids', 'access_token', 'refresh_token', 'expires_at', 'scope', 'connected_by', 'connected_at', 'disconnected_at', 'updated_at']] }
  });
  console.log('tab finance_moka_auth: dibuat + 13 header');
} else {
  console.log('tab finance_moka_auth: sudah ada (skip)');
}

// 2+3) kolom tambahan
const metaAll = (await sheets.spreadsheets.get({ spreadsheetId: sid })).data;
for (const [title, cols] of [['master_brand', ['email']], ['audit_log', ['chain_hash']]]) {
  const info = metaAll.sheets.find((s) => s.properties.title === title);
  if (!info) { console.log(`${title}: tab tidak ada!`); continue; }
  await appendHeader(title, cols, info.properties.sheetId, info.properties.gridProperties?.columnCount ?? 0);
}
fs.writeFileSync('/tmp/opencode/moka-migration-done.txt', 'ok');
console.log('migrasi selesai.');