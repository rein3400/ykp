#!/usr/bin/env node
/**
 * Unit spelling normalisation.
 *
 * The same physical unit was stored as g / gr / gram, pc / pcs, Pax / pax.
 * Those spellings are the same unit, so rewriting the label is safe and it
 * stops appendMovement from rejecting a post with "satuan ledger berbeda".
 * Quantities are never rescaled here.
 *
 *   node scripts/normalize-units.mjs          # dry run
 *   node scripts/normalize-units.mjs --apply
 */
import { google } from 'googleapis';

const APPLY = process.argv.includes('--apply');
const SPREADSHEET = process.env.YKP_WAREHOUSE_SPREADSHEET_ID;
if (!SPREADSHEET) {
  console.error('YKP_WAREHOUSE_SPREADSHEET_ID is required');
  process.exit(1);
}

const aliases = {
  kg: 'kg', kilogram: 'kg', g: 'g', gr: 'g', gram: 'g', grams: 'g',
  l: 'l', liter: 'l', litre: 'l', ml: 'ml', milliliter: 'ml', mililiter: 'ml',
  pcs: 'pc', piece: 'pc', pieces: 'pc', pc: 'pc', pax: 'pax', pack: 'pack', ikat: 'ikat', slice: 'slice',
};
const canonical = (value) => {
  const raw = String(value || '');
  return aliases[raw.trim().toLowerCase()] ?? raw;
};

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const columnLetter = (index) => {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};

const targets = [
  { tab: 'master_item', columns: ['base_unit', 'purchase_unit'] },
  { tab: 'warehouse_stock_movement', columns: ['base_unit'] },
  { tab: 'warehouse_batch_stock', columns: ['unit'] },
];

let changes = 0;
const updates = [];

for (const target of targets) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET, range: `'${target.tab}'!A1:AZ` });
  const values = res.data.values || [];
  if (values.length < 2) continue;
  const headers = values[0];
  for (const column of target.columns) {
    const index = headers.indexOf(column);
    if (index < 0) { console.log(`${target.tab}.${column}: column missing, skipped`); continue; }
    const rewritten = [];
    let changed = 0;
    for (const row of values.slice(1)) {
      const current = row[index] ?? '';
      const next = canonical(current);
      if (next !== current) changed += 1;
      rewritten.push([next]);
    }
    if (!changed) { console.log(`${target.tab}.${column}: clean`); continue; }
    const letter = columnLetter(index);
    const range = `'${target.tab}'!${letter}2:${letter}${rewritten.length + 1}`;
    changes += changed;
    updates.push({ range, values: rewritten, label: `${target.tab}.${column}`, changed });
    console.log(`${target.tab}.${column}: ${changed} rows to rewrite`);
  }
}

console.log(`total_cells=${changes}`);
if (!APPLY) { console.log('dry run — pass --apply to rewrite'); process.exit(0); }
if (!updates.length) { console.log('nothing to change'); process.exit(0); }

await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: SPREADSHEET,
  requestBody: {
    valueInputOption: 'RAW',
    data: updates.map((u) => ({ range: u.range, values: u.values })),
  },
});
console.log(`updated_ranges=${updates.length}`);
