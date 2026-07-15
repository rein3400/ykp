/**
 * Bootstrap: idempotently create all required tabs with header rows in
 * the configured spreadsheet. Run once before first use:
 *   npm run sheets:bootstrap
 *
 * Seeds master data per Warehouse V1 brief §8 (full item 32 columns,
 * locations, unit conversion, item category, inventory threshold, suppliers),
 * plus one owner user.
 */
import { getSheetsClient, getSpreadsheetId, TAB_HEADERS, TABS, columnLetter, type TabName } from '../src/db/sheets';
import { nowTimestampWib } from '../src/lib/format';

const t = nowTimestampWib();

const SEED_BRANDS = [
  ['BR-001', 'Funkydak', 'FKD', 'active', t, t],
  ['BR-002', 'Sekarpizza', 'SKP', 'active', t, t],
  ['BR-003', 'Suburbuns', 'SBN', 'active', t, t],
  ['BR-004', 'Laju Kopi', 'LJK', 'active', t, t],
  ['BR-005', 'Uncle Masala', 'UMS', 'active', t, t]
];

const SEED_OUTLETS = [
  ['OL-001', 'BR-001', 'Funkydak Cipete', 'FKD-01', 'Cipete Raya', 'active', t, t]
];

// §8.3 — expanded suppliers
const SEED_SUPPLIERS = [
  ['SUP-001', 'SUP-001', 'Supplier Utama Daging', 'protein', '081234000001', 'rahmat@supplier.com', 'Pasar Senen', 'BCA', '123456789', 'Bpk. Rahmat', '2', '500000', '3', 'active', t, t],
  ['SUP-002', 'SUP-002', 'Supplier Bahan Kering', 'dry', '081234000002', 'sari@supplier.com', 'Pasar Induk', 'Mandiri', '987654321', 'Ibu Sari', '1', '300000', '2', 'active', t, t]
];

// §8.1 — 10 critical items, full 32 columns
const SEED_ITEMS = [
  ['ITM-001', 'ITM-001', 'Daging Sapi Sirloin', 'BR-001', 'CAT-001', 'RAW_MATERIAL', 'kg', 'kg', '1', '1', '5', 'SUP-001', '', '180000', '175000', '5', '3', '25', '13', '5', '2', '1', '3', '5', 'CRITICAL', '2', '500000', 'YES', 'active', t, t, 'USR-001', 'USR-001'],
  ['ITM-002', 'ITM-002', 'Ayam Fillet', 'BR-001', 'CAT-001', 'RAW_MATERIAL', 'kg', 'kg', '1', '1', '10', 'SUP-001', '', '55000', '53000', '10', '5', '40', '27', '11', '2', '1', '3', '3', 'CRITICAL', '3', '300000', 'YES', 'active', t, t, 'USR-001', 'USR-001'],
  ['ITM-003', 'ITM-003', 'Salmon Fillet', 'BR-001', 'CAT-001', 'RAW_MATERIAL', 'kg', 'kg', '1', '1', '2', 'SUP-001', '', '320000', '315000', '3', '2', '12', '8', '3', '2', '1', '3', '3', 'HIGH', '2', '400000', 'YES', 'active', t, t, 'USR-001', 'USR-001'],
  ['ITM-004', 'ITM-004', 'Keju Mozzarella', 'BR-001', 'CAT-002', 'RAW_MATERIAL', 'kg', 'kg', '1', '1', '3', 'SUP-001', '', '145000', '142000', '4', '2', '15', '8', '3', '2', '1', '3', '7', 'HIGH', '3', '200000', 'YES', 'active', t, t, 'USR-001', 'USR-001'],
  ['ITM-005', 'ITM-005', 'Minyak Goreng', 'BR-001', 'CAT-003', 'RAW_MATERIAL', 'liter', 'liter', '1', '1', '20', 'SUP-002', '', '18000', '17500', '20', '10', '60', '30', '10', '1', '1', '2', '90', 'MEDIUM', '5', '100000', 'YES', 'active', t, t, 'USR-001', 'USR-001'],
  ['ITM-006', 'ITM-006', 'Gula Pasir', 'BR-001', 'CAT-003', 'RAW_MATERIAL', 'kg', 'kg', '1', '1', '10', 'SUP-002', '', '14000', '13800', '15', '8', '50', '23', '8', '1', '1', '2', '180', 'MEDIUM', '3', '100000', 'YES', 'active', t, t, 'USR-001', 'USR-001'],
  ['ITM-007', 'ITM-007', 'Kopi Arabica Bean', 'BR-001', 'CAT-003', 'RAW_MATERIAL', 'kg', 'kg', '1', '1', '3', 'SUP-002', '', '220000', '215000', '5', '3', '20', '10', '3.5', '3', '1', '4', '60', 'HIGH', '2', '300000', 'YES', 'active', t, t, 'USR-001', 'USR-001'],
  ['ITM-008', 'ITM-008', 'Butter Unsalted', 'BR-001', 'CAT-002', 'RAW_MATERIAL', 'kg', 'kg', '1', '1', '3', 'SUP-001', '', '95000', '92000', '5', '3', '15', '9', '3', '2', '1', '3', '14', 'MEDIUM', '3', '150000', 'YES', 'active', t, t, 'USR-001', 'USR-001'],
  ['ITM-009', 'ITM-009', 'Udang Vaname', 'BR-001', 'CAT-001', 'RAW_MATERIAL', 'kg', 'kg', '1', '1', '3', 'SUP-001', '', '110000', '108000', '4', '2', '15', '8', '3', '2', '1', '3', '2', 'HIGH', '3', '200000', 'YES', 'active', t, t, 'USR-001', 'USR-001'],
  ['ITM-010', 'ITM-010', 'Cokelat Couverture', 'BR-001', 'CAT-003', 'RAW_MATERIAL', 'kg', 'kg', '1', '1', '2', 'SUP-002', '', '165000', '160000', '3', '2', '10', '6', '2', '3', '1', '4', '30', 'MEDIUM', '2', '200000', 'YES', 'active', t, t, 'USR-001', 'USR-001']
];

// §8.2 — locations
const SEED_LOCATIONS = [
  ['LOC-001', 'FKD-CW', 'Gudang Pusat Funkydak', 'BR-001', '', 'CENTRAL_WAREHOUSE', '', 'Cipete', 'active', t, t],
  ['LOC-002', 'FKD-KIT', 'Kitchen Funkydak Cipete', 'BR-001', 'OL-001', 'KITCHEN', 'LOC-001', 'Cipete', 'active', t, t],
  ['LOC-003', 'FKD-CHL', 'Chiller Funkydak Cipete', 'BR-001', 'OL-001', 'CHILLER', 'LOC-001', 'Cipete', 'active', t, t],
  ['LOC-004', 'FKD-DRY', 'Dry Storage Funkydak Cipete', 'BR-001', 'OL-001', 'DRY_STORAGE', 'LOC-001', 'Cipete', 'active', t, t]
];

// §8.4 — unit conversions
const SEED_UNIT_CONVERSIONS = [
  ['CNV-001', 'ITM-001', 'kg', 'gram', '1000', 'active', t],
  ['CNV-002', 'ITM-005', 'liter', 'ml', '1000', 'active', t]
];

// §8.5 — item categories
const SEED_ITEM_CATEGORIES = [
  ['CAT-001', 'Protein', '', 'active', t],
  ['CAT-002', 'Dairy', '', 'active', t],
  ['CAT-003', 'Dry Goods', '', 'active', t]
];

// §8.6 — inventory thresholds
const SEED_THRESHOLDS = [
  ['THR-001', 'BR-001', 'OL-001', 'LOC-002', 'ITM-001', 'WASTE_DAILY_VALUE', '200000', '500000', '1000000', 'IDR', 'active', 'USR-001', t]
];

async function ensureTab(sheets: ReturnType<typeof getSheetsClient>, sid: string, tab: TabName): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === tab) ?? false;
  if (!exists) {
    console.log(`[bootstrap] creating tab: ${tab}`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sid,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] }
    });
  }
  const headers = TAB_HEADERS[tab];
  const lastCol = columnLetter(headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: `${quoteTab(tab)}!A1:${lastCol}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] }
  });
}

async function seedIfEmpty(
  sheets: ReturnType<typeof getSheetsClient>,
  sid: string,
  tab: TabName,
  rows: string[][]
): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: `${quoteTab(tab)}!A2:A2`
  });
  const existing = res.data.values?.[0]?.[0];
  if (existing && existing !== '') {
    console.log(`[seed] ${tab} already has data, skipping seed`);
    return;
  }
  if (rows.length === 0) return;
  console.log(`[seed] ${tab} -> ${rows.length} rows`);
  await sheets.spreadsheets.values.append({
    spreadsheetId: sid,
    range: `${quoteTab(tab)}!A2`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows }
  });
}

function quoteTab(tab: string): string {
  return /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${tab}'`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function seedUserOnce(sheets: ReturnType<typeof getSheetsClient>, sid: string): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: `${quoteTab(TABS.users)}!A2:A2`
  });
  if (res.data.values?.[0]?.[0]) {
    console.log('[seed] users already has data, skipping owner seed');
    return;
  }
  const { createHash } = await import('crypto');
  const pw = createHash('sha256').update('owner123').digest('hex');
  const row = ['USR-001', 'owner', pw, 'owner', '', '', 'active', t, ''];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sid,
    range: `${quoteTab(TABS.users)}!A2`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
  console.log('[seed] users -> owner/owner123 (CHANGE before pilot)');
}

async function main(): Promise<void> {
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();

  console.log('[bootstrap] spreadsheet:', sid);
  const tabList = Object.values(TABS);
  for (let i = 0; i < tabList.length; i++) {
    await ensureTab(sheets, sid, tabList[i]);
    if (i < tabList.length - 1) await sleep(1500); // stay under 60 writes/min
  }
  await seedIfEmpty(sheets, sid, TABS.brands, SEED_BRANDS); await sleep(800);
  await seedIfEmpty(sheets, sid, TABS.outlets, SEED_OUTLETS); await sleep(800);
  await seedIfEmpty(sheets, sid, TABS.suppliers, SEED_SUPPLIERS); await sleep(800);
  await seedIfEmpty(sheets, sid, TABS.items, SEED_ITEMS); await sleep(800);
  await seedIfEmpty(sheets, sid, TABS.locations, SEED_LOCATIONS); await sleep(800);
  await seedIfEmpty(sheets, sid, TABS.unitConversion, SEED_UNIT_CONVERSIONS); await sleep(800);
  await seedIfEmpty(sheets, sid, TABS.itemCategory, SEED_ITEM_CATEGORIES); await sleep(800);
  await seedIfEmpty(sheets, sid, TABS.inventoryThreshold, SEED_THRESHOLDS); await sleep(800);
  await seedUserOnce(sheets, sid);
  console.log('[bootstrap] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
