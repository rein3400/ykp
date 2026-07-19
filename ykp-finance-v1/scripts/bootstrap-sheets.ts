/**
 * Bootstrap: idempotently create all required tabs with header rows in the
 * configured spreadsheet. Run once before first use:
 *   npm run sheets:bootstrap
 *
 * Seeds master data (5 brands, outlets, suppliers, 15 expense categories,
 * payment methods, petty-cash accounts), threshold defaults (Revisi #10),
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
  ['OL-001', 'BR-001', 'Funkydak Cipete', 'FKD-01', 'Cipete Raya', 'active', t, t],
  ['OL-002', 'BR-001', 'Funkydak Kemang', 'FKD-02', 'Kemang Raya', 'active', t, t],
  ['OL-003', 'BR-002', 'Sekarpizza Demangan', 'SKP-01', 'Demangan', 'active', t, t],
  ['OL-004', 'BR-002', 'Sekarpizza Seturan', 'SKP-02', 'Seturan', 'active', t, t],
  ['OL-005', 'BR-003', 'Suburbuns Depok', 'SBN-01', 'Margonda', 'active', t, t],
  ['OL-006', 'BR-004', 'Laju Kopi Bintaro', 'LJK-01', 'Bintaro Jaya', 'active', t, t],
  ['OL-007', 'BR-005', 'Uncle Masala Tebet', 'UMS-01', 'Tebet Raya', 'active', t, t]
];

const SEED_SUPPLIERS = [
  ['SUP-001', 'CV Sumber Ayam Segar', 'Bahan Baku', '081234000001', 'BCA', '1234567001', 'CV Sumber Ayam Segar', 'active', t, t],
  ['SUP-002', 'Toko Daging Sapi Makmur', 'Bahan Baku', '081234000002', 'Mandiri', '1234567002', 'Toko Daging Sapi Makmur', 'active', t, t],
  ['SUP-003', 'UD Tepung & Bahan Kering', 'Bahan Baku', '081234000003', 'BCA', '1234567003', 'UD Tepung & Bahan Kering', 'active', t, t],
  ['SUP-004', 'CV Packaging Jaya', 'Packaging', '081234000004', 'Mandiri', '1234567004', 'CV Packaging Jaya', 'active', t, t],
  ['SUP-005', 'Sayur Segar Nusantara', 'Bahan Baku', '081234000005', 'BCA', '1234567005', 'Sayur Segar Nusantara', 'active', t, t]
];

const EXPENSE_CATEGORIES = [
  'Sewa', 'Gaji', 'Listrik', 'Air', 'Internet', 'Gas', 'Maintenance', 'Marketing',
  'Transport', 'Packaging', 'Refund', 'Diskon', 'Peralatan', 'Operational Mendadak', 'Other'
];
const SEED_CATEGORIES = EXPENSE_CATEGORIES.map((name, i) => [
  `CAT-${String(i + 1).padStart(3, '0')}`, name,
  name === 'Sewa' || name === 'Peralatan' ? 'CAPEX' : 'OPEX', 'active', t
]);

const SEED_METHODS = [
  ['PM-CASH', 'Cash', 'cash', 'true', 'active', t],
  ['PM-QRIS', 'QRIS', 'ewallet', 'false', 'active', t],
  ['PM-CARD', 'Kartu Debit/Kredit', 'card', 'false', 'active', t],
  ['PM-TRANSFER', 'Transfer Bank', 'transfer', 'false', 'active', t],
  ['PM-MARKETPLACE', 'Marketplace (GoFood/GrabFood/ShopeeFood)', 'marketplace', 'false', 'active', t]
];

const SEED_ACCOUNTS = SEED_OUTLETS.map((o, i) => [
  `PCA-${String(i + 1).padStart(3, '0')}`, o[0], o[1], `Kas Kecil ${o[2]}`,
  '1000000', '500000', 'IDR', 'active', t
]);

// Revisi #10 — threshold defaults (key, label, explanation, value, unit, severity, scope)
const SEED_THRESHOLDS = [
  ['cash_difference_warning', 'Peringatan Selisih Kas', 'Alert HIGH jika selisih kas fisik vs sistem sama atau lebih dari nilai ini.', '50000', 'IDR', 'HIGH'],
  ['cash_difference_critical', 'Selisih Kas Kritis', 'Alert CRITICAL untuk selisih kas sangat besar. Wajib audit.', '200000', 'IDR', 'CRITICAL'],
  ['supplier_overdue_days_warning', 'Supplier Jatuh Tempo', 'Alert MEDIUM jika ada invoice supplier lewat jatuh tempo lebih dari N hari.', '7', 'hari', 'MEDIUM'],
  ['supplier_overdue_days_critical', 'Supplier Overdue Kritis', 'Alert HIGH jika invoice supplier lewat jatuh tempo lebih dari N hari. Risiko supply stop.', '14', 'hari', 'HIGH'],
  ['petty_cash_daily_limit', 'Limit Kas Kecil Harian', 'Alert MEDIUM jika total pengeluaran kas kecil per outlet per hari melebihi nilai ini.', '500000', 'IDR', 'MEDIUM'],
  ['expense_spike_pct', 'Lonjakan Expense vs Rata-rata 7 Hari', 'Alert MEDIUM jika total expense hari ini naik lebih dari N persen dibanding rata-rata 7 hari sebelumnya.', '20', '%', 'MEDIUM'],
  ['supplier_cost_spike_pct', 'Kenaikan Biaya Supplier Mingguan', 'Alert MEDIUM/HIGH jika total pembelian supplier minggu ini naik lebih dari N persen dibanding minggu sebelumnya.', '15', '%', 'MEDIUM'],
  ['refund_void_pct_warning', 'Refund/Void Tinggi', 'Alert MEDIUM jika (refund + void) mencapai N persen dari gross sales hari ini.', '5', '%', 'MEDIUM'],
  ['refund_void_pct_high', 'Refund/Void Kritis', 'Alert HIGH jika (refund + void) mencapai N persen dari gross sales hari ini.', '10', '%', 'HIGH'],
  ['settlement_mismatch_tolerance', 'Toleransi Selisih Settlement POS', 'Alert MEDIUM jika total settlement per metode pembayaran tidak cocok dengan net sales melebihi nilai ini.', '10000', 'IDR', 'MEDIUM'],
  ['missing_receipt_min_amount', 'Minimal Nota Wajib Ada', 'Alert LOW untuk transaksi tanpa nota/bukti dengan nilai sama atau lebih dari ini.', '100000', 'IDR', 'LOW']
].map(([key, label, explanation, value, unit, severity], i) => [
  `THR-${String(i + 1).padStart(3, '0')}`, key, label, explanation, value, unit, severity,
  'GLOBAL', '', '', 'true', t, 'system'
]);

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
  const { default: bcrypt } = await import('bcryptjs');
  const pw = bcrypt.hashSync('owner123', 10);
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
  await seedIfEmpty(sheets, sid, TABS.expenseCategories, SEED_CATEGORIES); await sleep(800);
  await seedIfEmpty(sheets, sid, TABS.paymentMethods, SEED_METHODS); await sleep(800);
  await seedIfEmpty(sheets, sid, TABS.pettyCashAccounts, SEED_ACCOUNTS); await sleep(800);
  await seedIfEmpty(sheets, sid, TABS.thresholdConfig, SEED_THRESHOLDS); await sleep(800);
  await seedUserOnce(sheets, sid);
  console.log('[bootstrap] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
