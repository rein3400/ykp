#!/usr/bin/env node
/**
 * Transfer ledger reconciliation.
 *
 * Historical transfers posted one leg with reference_id = transfer_id, so the
 * opposite leg always tripped the duplicate guard and never reached the ledger.
 * New writes use `<transfer>-<OUT|IN>-<transfer_item_id>`, but existing rows
 * still need repair.
 *
 * Safety rules (never fabricate stock):
 *   - Post a missing TRANSFER_IN only when that line's TRANSFER_OUT exists.
 *   - Post a missing TRANSFER_OUT only when the source book stock covers it.
 *   - Anything else is reported as blocked for a human decision.
 *
 * Usage (inside the app container, or with the same env vars):
 *   node scripts/reconcile-transfers.mjs          # dry run
 *   node scripts/reconcile-transfers.mjs --apply  # write safe legs
 */
import { google } from 'googleapis';

const APPLY = process.argv.includes('--apply');
const SPREADSHEET = process.env.YKP_WAREHOUSE_SPREADSHEET_ID;
const LEGACY_MAX_RUN = 50;

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
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET,
    range: `'${tab}'!A1:AZ`,
  });
  const values = res.data.values || [];
  const headers = values[0] || [];
  return {
    headers,
    rows: values.slice(1).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))),
  };
};

const canonical = (unit) => {
  const u = String(unit || '').trim().toLowerCase();
  if (['pcs', 'piece', 'pieces', 'pc'].includes(u)) return 'pc';
  if (['g', 'gr', 'gram', 'grams'].includes(u)) return 'g';
  if (['kg', 'kilogram', 'kilograms'].includes(u)) return 'kg';
  if (['ml', 'milliliter', 'mililiter'].includes(u)) return 'ml';
  if (['l', 'liter', 'litre'].includes(u)) return 'l';
  return u;
};

const wibNow = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);

const movement = await readTab('warehouse_stock_movement');
const transfers = await readTab('warehouse_transfer');
const lines = await readTab('warehouse_transfer_item');

const bookOf = (itemId, locationId) => {
  const same = movement.rows.filter((m) => m.item_id === itemId && m.location_id === locationId);
  if (!same.length) return { qty: 0, unit: '' };
  const last = same.reduce((a, b) => (a.movement_datetime > b.movement_datetime ? a : b));
  return { qty: Number(last.stock_after || 0), unit: last.base_unit };
};

const legOf = (transferId, movementType, itemId, lineId) =>
  movement.rows.find(
    (m) =>
      m.reference_type === 'transfer' &&
      m.movement_type === movementType &&
      m.item_id === itemId &&
      (m.reference_id === `${transferId}-${movementType === 'TRANSFER_OUT' ? 'OUT' : 'IN'}-${lineId}` ||
        m.reference_id === transferId),
  );

const safe = [];
const blocked = [];
const plannedBalances = new Map();

for (const transfer of transfers.rows) {
  if (!['RECEIVED', 'DISCREPANCY', 'PARTIAL_RECEIVED', 'DISPATCHED'].includes(transfer.status)) continue;
  for (const line of lines.rows.filter((r) => r.transfer_id === transfer.transfer_id)) {
    const ambiguousLegacy = lines.rows.filter(row => row.transfer_id === transfer.transfer_id && row.item_id === line.item_id).length > 1 &&
      movement.rows.some(row => row.reference_type === 'transfer' && row.reference_id === transfer.transfer_id && row.item_id === line.item_id);
    if (ambiguousLegacy) {
      blocked.push({ transfer, line, type: 'TRANSFER_OUT', qty: Number(line.dispatched_qty || 0), location: transfer.source_location_id, book: bookOf(line.item_id, transfer.source_location_id), reason: 'ambiguous legacy movement for repeated item' });
      continue;
    }
    const out = legOf(transfer.transfer_id, 'TRANSFER_OUT', line.item_id, line.transfer_item_id);
    const inn = legOf(transfer.transfer_id, 'TRANSFER_IN', line.item_id, line.transfer_item_id);
    const outQty = Number(line.dispatched_qty || line.requested_qty || 0);
    const inQty = Number(line.received_qty || line.dispatched_qty || 0);
    const invalidOut = out && (Number(out.quantity) !== outQty || canonical(out.base_unit) !== canonical(line.unit) || out.location_id !== transfer.source_location_id);
    const invalidIn = inn && (Number(inn.quantity) !== inQty || canonical(inn.base_unit) !== canonical(line.unit) || inn.location_id !== transfer.destination_location_id);
    if (!Number.isFinite(outQty) || !Number.isFinite(inQty) || outQty < 0 || inQty < 0 || invalidOut || invalidIn) {
      blocked.push({ transfer, line, type: 'TRANSFER_OUT', qty: outQty, location: transfer.source_location_id, book: bookOf(line.item_id, transfer.source_location_id), reason: 'invalid quantity or existing ledger mismatch' });
      continue;
    }

    if (!out && outQty > 0 && ['RECEIVED', 'DISCREPANCY', 'DISPATCHED'].includes(transfer.status)) {
      const book = bookOf(line.item_id, transfer.source_location_id);
      const mismatch = book.unit && canonical(book.unit) !== canonical(line.unit);
      const entry = { transfer, line, type: 'TRANSFER_OUT', direction: 'OUT', qty: outQty, location: transfer.source_location_id, book, mismatch };
      const balanceKey = `${line.item_id}@${transfer.source_location_id}`;
      const available = plannedBalances.has(balanceKey) ? plannedBalances.get(balanceKey) : book.qty;
      if (!mismatch && Number.isFinite(available) && available >= outQty) {
        safe.push(entry);
        plannedBalances.set(balanceKey, available - outQty);
      } else blocked.push({ ...entry, reason: mismatch ? 'unit mismatch' : `source stock ${available} < ${outQty}` });
    }

    if (!inn && inQty > 0 && ['RECEIVED', 'DISCREPANCY', 'PARTIAL_RECEIVED'].includes(transfer.status)) {
      const book = bookOf(line.item_id, transfer.destination_location_id);
      const mismatch = book.unit && canonical(book.unit) !== canonical(line.unit);
      const entry = { transfer, line, type: 'TRANSFER_IN', direction: 'IN', qty: inQty, location: transfer.destination_location_id, book, mismatch };
      if (!out) blocked.push({ ...entry, reason: 'source leg missing; needs stock decision' });
      else if (mismatch) blocked.push({ ...entry, reason: 'unit mismatch' });
      else safe.push(entry);
    }
  }
}

const describe = (e) =>
  `${e.transfer.transfer_id} ${e.transfer.status} ${e.type} item=${e.line.item_id} qty=${e.qty} ${e.line.unit} @${e.location} book=${e.book.qty}`;

console.log(`transfers=${transfers.rows.length} lines=${lines.rows.length} movements=${movement.rows.length}`);
console.log(`safe_to_post=${safe.length} blocked=${blocked.length}`);
for (const e of safe) console.log(`  SAFE    ${describe(e)}`);
for (const e of blocked.slice(0, LEGACY_MAX_RUN)) console.log(`  BLOCKED ${describe(e)} — ${e.reason}`);
if (blocked.length > LEGACY_MAX_RUN) console.log(`  ... ${blocked.length - LEGACY_MAX_RUN} more blocked`);

if (!APPLY) {
  console.log('dry run — pass --apply to post the safe legs');
  process.exit(0);
}
if (safe.length === 0) {
  console.log('nothing to post');
  process.exit(0);
}

const running = new Map();
const rows = safe.map((entry) => {
  const key = `${entry.line.item_id}@${entry.location}`;
  const before = running.has(key) ? running.get(key) : entry.book.qty;
  const after = entry.direction === 'IN' ? before + entry.qty : before - entry.qty;
  running.set(key, after);
  const stamp = wibNow();
  const movementId = `MV-RECON-${entry.transfer.transfer_id}-${entry.type === 'TRANSFER_OUT' ? 'OUT' : 'IN'}-${entry.line.transfer_item_id}`;
  const record = {
    movement_id: movementId,
    movement_number: movementId,
    movement_datetime: stamp,
    item_id: entry.line.item_id,
    brand_id: '',
    outlet_id: '',
    location_id: entry.location,
    movement_type: entry.type,
    direction: entry.direction,
    quantity: String(entry.qty),
    base_unit: entry.line.unit,
    unit_cost: '0',
    total_value: '0',
    reference_type: 'transfer',
    reference_id: `${entry.transfer.transfer_id}-${entry.type === 'TRANSFER_OUT' ? 'OUT' : 'IN'}-${entry.line.transfer_item_id}`,
    source_location_id: entry.transfer.source_location_id,
    destination_location_id: entry.transfer.destination_location_id,
    stock_before: String(before),
    stock_after: String(after),
    created_by: 'USR-RECONCILE',
    approved_by: '',
    notes: `Reconcile missing ${entry.type} for ${entry.transfer.transfer_id}`,
    environment: process.env.ENVIRONMENT || 'PRODUCTION',
    created_at: stamp,
  };
  return movement.headers.map((header) => record[header] ?? '');
});

await sheets.spreadsheets.values.append({
  spreadsheetId: SPREADSHEET,
  range: `'warehouse_stock_movement'!A1`,
  valueInputOption: 'RAW',
  insertDataOption: 'INSERT_ROWS',
  requestBody: { values: rows },
});
console.log(`appended=${rows.length}`);
