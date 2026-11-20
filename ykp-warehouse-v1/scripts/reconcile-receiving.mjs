#!/usr/bin/env node
/**
 * Receiving ledger reconciliation.
 *
 * Early receiving posts referenced the legacy `<receiving>-<item_id>` scheme,
 * so a second line for the same item tripped the duplicate guard and its
 * RECEIPT movement never reached the ledger. The receiving detail row exists,
 * which means stock was physically received but never booked.
 *
 * This script posts the missing RECEIPT movements (IN is always safe) using
 * the same base-unit conversion the API applies. Lines whose unit conversion is
 * not configured are reported instead of guessed.
 *
 *   node scripts/reconcile-receiving.mjs          # dry run
 *   node scripts/reconcile-receiving.mjs --apply
 */
import { google } from 'googleapis';

const APPLY = process.argv.includes('--apply');
const SPREADSHEET = process.env.YKP_WAREHOUSE_SPREADSHEET_ID;
if (!SPREADSHEET) {
  console.error('YKP_WAREHOUSE_SPREADSHEET_ID is required');
  process.exit(1);
}

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const readTab = async (tab) => {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET, range: `'${tab}'!A1:AZ` });
  const values = res.data.values || [];
  const headers = values[0] || [];
  return { headers, rows: values.slice(1).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))) };
};

const aliases = {
  kg: 'kg', kilogram: 'kg', g: 'g', gr: 'g', gram: 'g', grams: 'g',
  l: 'l', liter: 'l', litre: 'l', ml: 'ml', milliliter: 'ml', mililiter: 'ml',
  pcs: 'pc', piece: 'pc', pieces: 'pc', pc: 'pc', pax: 'pax', pack: 'pack', ikat: 'ikat', slice: 'slice',
};
const alias = (value) => aliases[String(value || '').trim().toLowerCase()] ?? String(value || '').trim().toLowerCase();
const scales = { kg: { d: 'mass', s: 1000 }, g: { d: 'mass', s: 1 }, l: { d: 'volume', s: 1000 }, ml: { d: 'volume', s: 1 } };
const fixedFactor = (from, to) => {
  const a = scales[alias(from)];
  const b = scales[alias(to)];
  return a && b && a.d === b.d ? a.s / b.s : null;
};

const [movement, receiving, lines, items, conversions] = await Promise.all([
  readTab('warehouse_stock_movement'),
  readTab('warehouse_receiving'),
  readTab('warehouse_receiving_item'),
  readTab('master_item'),
  readTab('master_unit_conversion'),
]);
const itemById = new Map(items.rows.map((i) => [i.item_id, i]));

const convert = (item, rawUnit, qty, price) => {
  const from = alias(rawUnit);
  const to = alias(item?.base_unit ?? '');
  if (!from || !to) throw new Error('satuan tidak valid');
  let factor = from === to ? 1 : fixedFactor(from, to);
  if (factor === null) {
    const matches = conversions.rows.filter(
      (r) => r.item_id === item.item_id && r.active_status === 'active' && alias(r.from_unit) === from && alias(r.to_unit) === to,
    );
    if (matches.length !== 1) throw new Error('konversi satuan belum tersedia');
    factor = Number(matches[0].conversion_factor);
  }
  if (!Number.isFinite(factor) || factor <= 0) throw new Error('faktor konversi tidak valid');
  return { quantity: qty * factor, unitCost: price / factor, unit: to };
};

const legacyRefs = new Map();
for (const m of movement.rows) {
  if (m.reference_type !== 'receiving') continue;
  legacyRefs.set(m.reference_id, (legacyRefs.get(m.reference_id) ?? 0) + 1);
}
const newRefs = new Set(movement.rows.filter((m) => m.reference_type === 'receiving').map((m) => m.reference_id));

const pending = [];
const blocked = [];

for (const header of receiving.rows) {
  if ((header.receiving_status || '').toUpperCase() === 'CANCELLED') continue;
  if (!header.destination_location_id) continue;
  const receiptLines = lines.rows.filter((l) => l.receiving_id === header.receiving_id);
  const legacyAvailable = new Map();
  for (const l of receiptLines) {
    const ref = `${header.receiving_id}-${l.item_id}`;
    if (!legacyAvailable.has(l.item_id)) legacyAvailable.set(l.item_id, legacyRefs.get(ref) ?? 0);
  }
  for (const line of receiptLines) {
    const newRef = `${header.receiving_id}-${line.receiving_item_id}`;
    if (newRefs.has(newRef)) continue;
    const left = legacyAvailable.get(line.item_id) ?? 0;
    if (left > 0) {
      const legacy = movement.rows.filter(row => row.reference_type === 'receiving' && row.reference_id === `${header.receiving_id}-${line.item_id}`);
      if (receiptLines.filter(row => row.item_id === line.item_id).length > 1 || legacy.length !== 1 ||
        legacy[0].movement_type !== 'RECEIPT' || legacy[0].direction !== 'IN' || legacy[0].location_id !== header.destination_location_id) {
        blocked.push({ line, header, reason: 'posting legacy ambigu atau tidak sesuai' });
      }
      continue;
    }
    const qty = Number(line.qty_accepted || 0);
    if (!(qty > 0)) continue;
    const item = itemById.get(line.item_id);
    if (!item) { blocked.push({ line, header, reason: 'item tidak ada di master' }); continue; }
    try {
      const converted = convert(item, line.unit, qty, Number(line.unit_price || 0));
      const book = movement.rows.filter(row => row.item_id === line.item_id && row.location_id === header.destination_location_id);
      if (book.some(row => alias(row.base_unit) !== converted.unit || !Number.isFinite(Number(row.stock_after)))) {
        blocked.push({ line, header, reason: 'satuan atau saldo ledger lama tidak cocok' });
        continue;
      }
      pending.push({ header, line, qty: converted.quantity, unit: converted.unit, unitCost: converted.unitCost, totalValue: Math.round(qty * Number(line.unit_price || 0)) });
    } catch (e) {
      blocked.push({ line, header, reason: e instanceof Error ? e.message : 'konversi gagal' });
    }
  }
}

const wibNow = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
const bookOf = (itemId, locationId, extra) => {
  const same = [...movement.rows, ...extra].filter((m) => m.item_id === itemId && m.location_id === locationId);
  if (!same.length) return 0;
  const last = same.reduce((a, b) => (a.movement_datetime > b.movement_datetime ? a : b));
  return Number(last.stock_after || 0);
};

const sorted = pending.sort((a, b) => (a.header.receiving_datetime || a.header.date || '').localeCompare(b.header.receiving_datetime || b.header.date || ''));

console.log(`receipts=${receiving.rows.length} lines=${lines.rows.length} to_post=${sorted.length} blocked=${blocked.length}`);
for (const p of sorted.slice(0, 20)) {
  console.log(`  ${p.header.receiving_id} item=${p.line.item_id} qty=${p.qty} ${p.unit} cost=${Number(p.unitCost.toFixed(4))} @${p.header.destination_location_id}`);
}
if (sorted.length > 20) console.log(`  ... ${sorted.length - 20} more`);
for (const b of blocked.slice(0, 20)) console.log(`  BLOCKED ${b.header.receiving_id} item=${b.line.item_id} unit=${b.line.unit} — ${b.reason}`);

if (!APPLY) { console.log('dry run — pass --apply to post'); process.exit(0); }
if (!sorted.length) { console.log('nothing to post'); process.exit(0); }

const extra = [];
const runningBook = new Map();
const rowsToAppend = sorted.map((p) => {
  const key = `${p.line.item_id}@${p.header.destination_location_id}`;
  const before = runningBook.has(key) ? runningBook.get(key) : bookOf(p.line.item_id, p.header.destination_location_id, extra);
  const after = before + p.qty;
  runningBook.set(key, after);
  const stamp = wibNow();
  const movementId = `MV-RCVFIX-${p.header.receiving_id}-${p.line.receiving_item_id}`;
  const record = {
    movement_id: movementId,
    movement_number: movementId,
    movement_datetime: stamp,
    item_id: p.line.item_id,
    brand_id: '',
    outlet_id: '',
    location_id: p.header.destination_location_id,
    movement_type: 'RECEIPT',
    direction: 'IN',
    quantity: String(p.qty),
    base_unit: p.unit,
    unit_cost: String(p.unitCost),
    total_value: String(p.totalValue),
    reference_type: 'receiving',
    reference_id: `${p.header.receiving_id}-${p.line.receiving_item_id}`,
    source_location_id: '',
    destination_location_id: p.header.destination_location_id,
    stock_before: String(before),
    stock_after: String(after),
    created_by: 'USR-RECONCILE',
    approved_by: '',
    notes: `Reconcile missing receipt line for ${p.header.receiving_id}`,
    environment: process.env.ENVIRONMENT || 'PRODUCTION',
    created_at: stamp,
  };
  extra.push(record);
  return movement.headers.map((h) => record[h] ?? '');
});

await sheets.spreadsheets.values.append({
  spreadsheetId: SPREADSHEET,
  range: `'warehouse_stock_movement'!A1`,
  valueInputOption: 'RAW',
  insertDataOption: 'INSERT_ROWS',
  requestBody: { values: rowsToAppend },
});
console.log(`appended=${rowsToAppend.length}`);
