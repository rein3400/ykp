/**
 * Seed master_item from the ETL owner-data pack:
 *   ../etl/output/master_items.csv  (263 real Funkydak items)
 *
 *   npm run seed:master-items
 *
 * Idempotent: skips items whose normalized name already exists in master_item.
 * Review ../etl/output/master_items.csv BEFORE running — this writes real data.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getSheetsClient, getSpreadsheetId, TABS, appendRows, readTab } from '../src/db/sheets';

const CSV_PATH = resolve(__dirname, '../../etl/output/master_items.csv');
const BATCH = 50;

/** Minimal RFC4180 CSV parse (handles quoted commas/quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function norm(s: string): string {
  return s.normalize('NFKD').replace(/[^ -~]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

async function main() {
  // Touch the client early to fail fast on missing env config.
  getSheetsClient();
  getSpreadsheetId();

  const text = readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCsv(text);
  const header = rows[0];
  const col = (name: string) => header.indexOf(name);
  const data = rows.slice(1).map((r) => ({
    item_code: r[col('item_code')] ?? '',
    item_name: r[col('item_name')] ?? '',
    category_id: r[col('category_id')] ?? '',
    base_unit: r[col('base_unit')] ?? '',
    latest_purchase_price: r[col('latest_purchase_price')] ?? '0',
    minimum_stock: r[col('minimum_stock')] ?? '0',
    criticality: r[col('criticality')] ?? 'STANDARD',
    tolerance_variance_percentage: r[col('tolerance_variance_percentage')] ?? '2',
    active_status: r[col('active_status')] ?? 'active',
    created_at: r[col('created_at')] ?? ''
  }));

  const existing = await readTab<Record<string, string>>(TABS.items);
  const existingNames = new Set(existing.map((e) => norm(e.item_name ?? '')));
  const fresh = data.filter((d) => d.item_name && !existingNames.has(norm(d.item_name)));
  console.log(`master_item: ${existing.length} existing, ${data.length} in CSV, ${fresh.length} to insert`);

  const now = new Date().toISOString();
  const out = fresh.map((d, i) => ({
    item_id: `ITM-ETL-${String(i + 1).padStart(4, '0')}`,
    item_code: d.item_code,
    item_name: d.item_name,
    brand_id: '',
    category_id: d.category_id,
    item_type: 'RAW_MATERIAL',
    base_unit: d.base_unit,
    purchase_unit: d.base_unit,
    conversion_factor: '1',
    pack_size: '1',
    minimum_order_quantity: '1',
    preferred_supplier_id: '',
    backup_supplier_id: '',
    latest_purchase_price: d.latest_purchase_price,
    average_purchase_price: d.latest_purchase_price,
    minimum_stock: d.minimum_stock,
    safety_stock: '',
    maximum_stock: '',
    reorder_point: d.minimum_stock,
    average_daily_usage: '',
    supplier_lead_time_days: '1',
    supplier_order_day: '',
    supplier_delivery_day: '',
    expiry_days: '',
    criticality: d.criticality,
    tolerance_variance_percentage: d.tolerance_variance_percentage,
    tolerance_variance_value: '',
    recipe_linked_status: 'UNLINKED',
    active_status: d.active_status,
    created_at: d.created_at || now,
    updated_at: '',
    created_by: 'etl',
    updated_by: ''
  }));

  for (let i = 0; i < out.length; i += BATCH) {
    await appendRows(TABS.items, out.slice(i, i + BATCH));
    console.log(`  inserted ${Math.min(i + BATCH, out.length)}/${out.length}`);
  }
  console.log('DONE');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
