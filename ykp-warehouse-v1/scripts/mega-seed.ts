/**
 * MEGA MOCK SEED — complex multi-brand / multi-outlet / 30-day warehouse data.
 * Uses the EXISTING multi-tab spreadsheet (1 spreadsheet = many tabs).
 * NOT a single-tab dump — Sheets quota + app schema require one tab per table.
 *
 *   npm run sheets:mega-seed
 *
 * Idempotent-ish: appends data with MEGA- prefix IDs. Safe to re-run for more volume
 * (will create duplicates if re-run — intended for demo density).
 */
import { getSheetsClient, getSpreadsheetId, TAB_HEADERS, TABS, appendRows, readTab, type TabName } from '../src/db/sheets';
import { nowTimestampWib, formatDateWib } from '../src/lib/format';
import { createHash } from 'crypto';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function dayOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return formatDateWib(d);
}

function pad(n: number, w = 3) {
  return String(n).padStart(w, '0');
}

function id(prefix: string, n: number) {
  return `MEGA-${prefix}-${pad(n, 4)}`;
}

function hashPw(p: string) {
  return createHash('sha256').update(p).digest('hex');
}

const BRANDS = [
  { id: 'BR-001', name: 'Funkydak', code: 'FKD' },
  { id: 'BR-002', name: 'Sekarpizza', code: 'SKP' },
  { id: 'BR-003', name: 'Suburbuns', code: 'SBN' },
  { id: 'BR-004', name: 'Laju Kopi', code: 'LJK' },
  { id: 'BR-005', name: 'Uncle Masala', code: 'UMS' }
];

const OUTLETS = [
  { id: 'OL-001', brand: 'BR-001', name: 'Funkydak Cipete', code: 'FKD-01', addr: 'Cipete Raya 12' },
  { id: 'OL-002', brand: 'BR-001', name: 'Funkydak Kemang', code: 'FKD-02', addr: 'Kemang Raya 8' },
  { id: 'OL-003', brand: 'BR-002', name: 'Sekarpizza Senopati', code: 'SKP-01', addr: 'Senopati 21' },
  { id: 'OL-004', brand: 'BR-002', name: 'Sekarpizza BSD', code: 'SKP-02', addr: 'BSD Green Office' },
  { id: 'OL-005', brand: 'BR-003', name: 'Suburbuns SCBD', code: 'SBN-01', addr: 'SCBD Lot 9' },
  { id: 'OL-006', brand: 'BR-004', name: 'Laju Kopi Menteng', code: 'LJK-01', addr: 'Menteng Atas' },
  { id: 'OL-007', brand: 'BR-005', name: 'Uncle Masala Blok M', code: 'UMS-01', addr: 'Blok M Square' }
];

const SUPPLIERS = [
  { id: 'SUP-001', code: 'SUP-DAG', name: 'PT Daging Nusantara', cat: 'protein', lead: 2, phone: '0812000001' },
  { id: 'SUP-002', code: 'SUP-DRY', name: 'CV Bahan Kering Jaya', cat: 'dry', lead: 1, phone: '0812000002' },
  { id: 'SUP-003', code: 'SUP-SEA', name: 'PT Laut Segar', cat: 'seafood', lead: 1, phone: '0812000003' },
  { id: 'SUP-004', code: 'SUP-DAI', name: 'Dairy Fresh Indo', cat: 'dairy', lead: 2, phone: '0812000004' },
  { id: 'SUP-005', code: 'SUP-VEG', name: 'Tani Sayur Bogor', cat: 'produce', lead: 1, phone: '0812000005' },
  { id: 'SUP-006', code: 'SUP-PKG', name: 'Packaging Prima', cat: 'packaging', lead: 3, phone: '0812000006' },
  { id: 'SUP-007', code: 'SUP-SPICE', name: 'Rempah Nusantara', cat: 'spice', lead: 2, phone: '0812000007' },
  { id: 'SUP-008', code: 'SUP-OIL', name: 'Minyak Sawit Sejahtera', cat: 'oil', lead: 1, phone: '0812000008' }
];

const CATEGORIES = [
  { id: 'CAT-001', name: 'Protein' },
  { id: 'CAT-002', name: 'Dairy' },
  { id: 'CAT-003', name: 'Dry Goods' },
  { id: 'CAT-004', name: 'Seafood' },
  { id: 'CAT-005', name: 'Produce' },
  { id: 'CAT-006', name: 'Packaging' },
  { id: 'CAT-007', name: 'Spice & Seasoning' },
  { id: 'CAT-008', name: 'Beverage Base' }
];

// 25 critical items across categories
const ITEMS = [
  { id: 'ITM-001', name: 'Daging Sapi Sirloin', cat: 'CAT-001', unit: 'kg', price: 180000, min: 5, safety: 3, max: 25, usage: 5, lead: 2, crit: 'CRITICAL', sup: 'SUP-001', exp: 5 },
  { id: 'ITM-002', name: 'Ayam Fillet', cat: 'CAT-001', unit: 'kg', price: 55000, min: 10, safety: 5, max: 40, usage: 11, lead: 2, crit: 'CRITICAL', sup: 'SUP-001', exp: 3 },
  { id: 'ITM-003', name: 'Salmon Fillet', cat: 'CAT-004', unit: 'kg', price: 320000, min: 3, safety: 2, max: 12, usage: 3, lead: 1, crit: 'HIGH', sup: 'SUP-003', exp: 3 },
  { id: 'ITM-004', name: 'Keju Mozzarella', cat: 'CAT-002', unit: 'kg', price: 145000, min: 4, safety: 2, max: 15, usage: 3, lead: 2, crit: 'HIGH', sup: 'SUP-004', exp: 7 },
  { id: 'ITM-005', name: 'Minyak Goreng', cat: 'CAT-003', unit: 'liter', price: 18000, min: 20, safety: 10, max: 60, usage: 10, lead: 1, crit: 'MEDIUM', sup: 'SUP-008', exp: 90 },
  { id: 'ITM-006', name: 'Gula Pasir', cat: 'CAT-003', unit: 'kg', price: 14000, min: 15, safety: 8, max: 50, usage: 8, lead: 1, crit: 'MEDIUM', sup: 'SUP-002', exp: 180 },
  { id: 'ITM-007', name: 'Kopi Arabica Bean', cat: 'CAT-008', unit: 'kg', price: 220000, min: 5, safety: 3, max: 20, usage: 3.5, lead: 3, crit: 'HIGH', sup: 'SUP-002', exp: 60 },
  { id: 'ITM-008', name: 'Butter Unsalted', cat: 'CAT-002', unit: 'kg', price: 95000, min: 5, safety: 3, max: 15, usage: 3, lead: 2, crit: 'MEDIUM', sup: 'SUP-004', exp: 14 },
  { id: 'ITM-009', name: 'Udang Vaname', cat: 'CAT-004', unit: 'kg', price: 110000, min: 4, safety: 2, max: 15, usage: 3, lead: 1, crit: 'HIGH', sup: 'SUP-003', exp: 2 },
  { id: 'ITM-010', name: 'Cokelat Couverture', cat: 'CAT-003', unit: 'kg', price: 165000, min: 3, safety: 2, max: 10, usage: 2, lead: 3, crit: 'MEDIUM', sup: 'SUP-002', exp: 30 },
  { id: 'ITM-011', name: 'Daging Kambing', cat: 'CAT-001', unit: 'kg', price: 140000, min: 4, safety: 2, max: 15, usage: 2.5, lead: 2, crit: 'HIGH', sup: 'SUP-001', exp: 4 },
  { id: 'ITM-012', name: 'Whipping Cream', cat: 'CAT-002', unit: 'liter', price: 85000, min: 6, safety: 3, max: 18, usage: 4, lead: 2, crit: 'HIGH', sup: 'SUP-004', exp: 10 },
  { id: 'ITM-013', name: 'Tepung Terigu', cat: 'CAT-003', unit: 'kg', price: 12000, min: 25, safety: 15, max: 80, usage: 12, lead: 1, crit: 'MEDIUM', sup: 'SUP-002', exp: 120 },
  { id: 'ITM-014', name: 'Telur Ayam', cat: 'CAT-001', unit: 'kg', price: 28000, min: 10, safety: 5, max: 30, usage: 6, lead: 1, crit: 'MEDIUM', sup: 'SUP-001', exp: 14 },
  { id: 'ITM-015', name: 'Bawang Bombay', cat: 'CAT-005', unit: 'kg', price: 22000, min: 8, safety: 4, max: 25, usage: 5, lead: 1, crit: 'LOW', sup: 'SUP-005', exp: 10 },
  { id: 'ITM-016', name: 'Tomat Cherry', cat: 'CAT-005', unit: 'kg', price: 45000, min: 3, safety: 2, max: 10, usage: 2, lead: 1, crit: 'MEDIUM', sup: 'SUP-005', exp: 5 },
  { id: 'ITM-017', name: 'Basil Fresh', cat: 'CAT-005', unit: 'ikat', price: 8000, min: 10, safety: 5, max: 30, usage: 8, lead: 1, crit: 'HIGH', sup: 'SUP-005', exp: 3 },
  { id: 'ITM-018', name: 'Garam Dapur', cat: 'CAT-007', unit: 'kg', price: 5000, min: 5, safety: 3, max: 20, usage: 1, lead: 2, crit: 'LOW', sup: 'SUP-007', exp: 365 },
  { id: 'ITM-019', name: 'Lada Hitam Bubuk', cat: 'CAT-007', unit: 'kg', price: 120000, min: 1, safety: 0.5, max: 5, usage: 0.3, lead: 3, crit: 'LOW', sup: 'SUP-007', exp: 180 },
  { id: 'ITM-020', name: 'Saus Tomat Kaleng', cat: 'CAT-003', unit: 'kg', price: 35000, min: 8, safety: 4, max: 25, usage: 4, lead: 2, crit: 'MEDIUM', sup: 'SUP-002', exp: 90 },
  { id: 'ITM-021', name: 'Box Takeaway M', cat: 'CAT-006', unit: 'pcs', price: 1500, min: 200, safety: 100, max: 1000, usage: 80, lead: 3, crit: 'MEDIUM', sup: 'SUP-006', exp: 365 },
  { id: 'ITM-022', name: 'Cup 12oz', cat: 'CAT-006', unit: 'pcs', price: 800, min: 300, safety: 150, max: 1500, usage: 120, lead: 3, crit: 'MEDIUM', sup: 'SUP-006', exp: 365 },
  { id: 'ITM-023', name: 'Susu Full Cream', cat: 'CAT-002', unit: 'liter', price: 18000, min: 15, safety: 8, max: 40, usage: 10, lead: 1, crit: 'HIGH', sup: 'SUP-004', exp: 7 },
  { id: 'ITM-024', name: 'Ikan Tenggiri', cat: 'CAT-004', unit: 'kg', price: 95000, min: 5, safety: 2, max: 15, usage: 3, lead: 1, crit: 'HIGH', sup: 'SUP-003', exp: 2 },
  { id: 'ITM-025', name: 'Kentang French Fries', cat: 'CAT-003', unit: 'kg', price: 42000, min: 10, safety: 5, max: 40, usage: 8, lead: 2, crit: 'MEDIUM', sup: 'SUP-002', exp: 60 }
];

async function appendBatched(tab: TabName, rows: Record<string, string>[], batchSize = 40) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await appendRows(tab, chunk);
    console.log(`  [${tab}] +${chunk.length} (total ${Math.min(i + batchSize, rows.length)}/${rows.length})`);
    await sleep(1200); // stay under Sheets write quota
  }
}

async function main() {
  // Force real sheets (not mock)
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.YKP_WAREHOUSE_SPREADSHEET_ID) {
    throw new Error('Need GOOGLE_SERVICE_ACCOUNT_EMAIL + YKP_WAREHOUSE_SPREADSHEET_ID');
  }
  process.env.USE_MOCK_DB = 'false';

  const now = nowTimestampWib();
  console.log('[mega-seed] spreadsheet', getSpreadsheetId());
  console.log('[mega-seed] time', now);

  // Ensure client works
  getSheetsClient();

  // ── Master brands / outlets (upsert-ish: append if missing) ──
  const existingBrands = await readTab(TABS.brands);
  const brandIds = new Set(existingBrands.map((b) => b.brand_id));
  const newBrands = BRANDS.filter((b) => !brandIds.has(b.id)).map((b) => ({
    brand_id: b.id, brand_name: b.name, brand_code: b.code, status: 'active', created_at: now, updated_at: now
  }));
  await appendBatched(TABS.brands, newBrands);

  const existingOutlets = await readTab(TABS.outlets);
  const outletIds = new Set(existingOutlets.map((o) => o.outlet_id));
  const newOutlets = OUTLETS.filter((o) => !outletIds.has(o.id)).map((o) => ({
    outlet_id: o.id, brand_id: o.brand, outlet_name: o.name, outlet_code: o.code,
    address: o.addr, status: 'active', created_at: now, updated_at: now
  }));
  await appendBatched(TABS.outlets, newOutlets);

  // Categories
  const existingCat = await readTab(TABS.itemCategory);
  const catIds = new Set(existingCat.map((c) => c.category_id));
  await appendBatched(TABS.itemCategory, CATEGORIES.filter((c) => !catIds.has(c.id)).map((c) => ({
    category_id: c.id, category_name: c.name, parent_category_id: '', active_status: 'active', created_at: now
  })));

  // Suppliers
  const existingSup = await readTab(TABS.suppliers);
  const supIds = new Set(existingSup.map((s) => s.supplier_id));
  await appendBatched(TABS.suppliers, SUPPLIERS.filter((s) => !supIds.has(s.id)).map((s) => ({
    supplier_id: s.id, supplier_code: s.code, supplier_name: s.name, item_category: s.cat,
    phone: s.phone, email: `${s.code.toLowerCase()}@supplier.ykp.local`, address: 'Jakarta',
    bank_name: 'BCA', bank_account: `12${s.id.slice(-3)}456`, account_holder: s.name,
    lead_time_days: String(s.lead), minimum_order_value: '500000', preferred_delivery_day: String(1 + (s.lead % 5)),
    active_status: 'active', created_at: now, updated_at: now
  })));

  // Items
  const existingItems = await readTab(TABS.items);
  const itemIds = new Set(existingItems.map((i) => i.item_id));
  await appendBatched(TABS.items, ITEMS.filter((it) => !itemIds.has(it.id)).map((it) => {
    const reorder = Math.round(it.usage * it.lead + it.safety);
    return {
      item_id: it.id, item_code: it.id, item_name: it.name, brand_id: '', category_id: it.cat,
      item_type: 'RAW_MATERIAL', base_unit: it.unit, purchase_unit: it.unit, conversion_factor: '1',
      pack_size: '1', minimum_order_quantity: String(Math.max(1, Math.ceil(it.min / 2))),
      preferred_supplier_id: it.sup, backup_supplier_id: '',
      latest_purchase_price: String(it.price), average_purchase_price: String(Math.round(it.price * 0.97)),
      minimum_stock: String(it.min), safety_stock: String(it.safety), maximum_stock: String(it.max),
      reorder_point: String(reorder), average_daily_usage: String(it.usage),
      supplier_lead_time_days: String(it.lead), supplier_order_day: '1', supplier_delivery_day: String(1 + it.lead),
      expiry_days: String(it.exp), criticality: it.crit,
      tolerance_variance_percentage: it.crit === 'CRITICAL' ? '2' : '5',
      tolerance_variance_value: String(it.price * 2),
      recipe_linked_status: 'YES', active_status: 'active',
      created_at: now, updated_at: now, created_by: 'USR-001', updated_by: 'USR-001'
    };
  }));

  // Locations: central + kitchen + chiller per outlet
  const existingLoc = await readTab(TABS.locations);
  const locIds = new Set(existingLoc.map((l) => l.location_id));
  const locations: Record<string, string>[] = [];
  let locN = 100;
  // Central warehouses per brand
  for (const b of BRANDS) {
    const lid = `LOC-${pad(locN++)}`;
    if (!locIds.has(lid) && ![...locIds].some((id) => id.includes(b.code))) {
      locations.push({
        location_id: lid, location_code: `${b.code}-CW`, location_name: `Gudang Pusat ${b.name}`,
        brand_id: b.id, outlet_id: '', location_type: 'CENTRAL_WAREHOUSE', parent_location_id: '',
        address: 'Jakarta HQ', active_status: 'active', created_at: now, updated_at: now
      });
    }
  }
  for (const o of OUTLETS) {
    const brand = BRANDS.find((b) => b.id === o.brand)!;
    for (const [type, suffix] of [
      ['OUTLET_WAREHOUSE', 'OW'],
      ['KITCHEN', 'KIT'],
      ['CHILLER', 'CHL'],
      ['DRY_STORAGE', 'DRY']
    ] as const) {
      const lid = `LOC-${pad(locN++)}`;
      locations.push({
        location_id: lid, location_code: `${o.code}-${suffix}`,
        location_name: `${type.replace(/_/g, ' ')} ${o.name}`,
        brand_id: o.brand, outlet_id: o.id, location_type: type, parent_location_id: '',
        address: o.addr, active_status: 'active', created_at: now, updated_at: now
      });
    }
  }
  // filter already-existing by code
  const existingCodes = new Set(existingLoc.map((l) => l.location_code));
  await appendBatched(TABS.locations, locations.filter((l) => !existingCodes.has(l.location_code)));

  const allLocs = await readTab(TABS.locations);
  const outletWarehouses = allLocs.filter((l) => l.location_type === 'OUTLET_WAREHOUSE' || l.location_type === 'KITCHEN' || l.location_type === 'CHILLER');

  // Users (multi-role)
  const users: Record<string, string>[] = [
    { user_id: 'USR-MEGA-001', username: 'wh_admin', password_hash: hashPw('admin123'), role: 'warehouse_admin', brand_id: '', outlet_id: '', active_status: 'active', created_at: now, last_login_at: '' },
    { user_id: 'USR-MEGA-002', username: 'purchasing', password_hash: hashPw('purchase123'), role: 'purchasing', brand_id: '', outlet_id: '', active_status: 'active', created_at: now, last_login_at: '' },
    { user_id: 'USR-MEGA-003', username: 'fkd_mgr', password_hash: hashPw('manager123'), role: 'brand_manager', brand_id: 'BR-001', outlet_id: '', active_status: 'active', created_at: now, last_login_at: '' },
    { user_id: 'USR-MEGA-004', username: 'cipete_pic', password_hash: hashPw('pic12345'), role: 'supervisor', brand_id: 'BR-001', outlet_id: 'OL-001', active_status: 'active', created_at: now, last_login_at: '' },
    { user_id: 'USR-MEGA-005', username: 'kitchen_lead', password_hash: hashPw('kitchen1'), role: 'kitchen_lead', brand_id: 'BR-001', outlet_id: 'OL-001', active_status: 'active', created_at: now, last_login_at: '' },
    { user_id: 'USR-MEGA-006', username: 'staff1', password_hash: hashPw('staff123'), role: 'staff', brand_id: 'BR-001', outlet_id: 'OL-001', active_status: 'active', created_at: now, last_login_at: '' },
    { user_id: 'USR-MEGA-007', username: 'viewer', password_hash: hashPw('viewer12'), role: 'viewer', brand_id: '', outlet_id: '', active_status: 'active', created_at: now, last_login_at: '' },
    { user_id: 'USR-MEGA-008', username: 'finance', password_hash: hashPw('finance1'), role: 'finance_admin', brand_id: '', outlet_id: '', active_status: 'active', created_at: now, last_login_at: '' }
  ];
  const existingUsers = await readTab(TABS.users);
  const userNames = new Set(existingUsers.map((u) => u.username));
  await appendBatched(TABS.users, users.filter((u) => !userNames.has(u.username)));

  // Unit conversions
  const convs = [
    { id: id('CNV', 1), item: 'ITM-001', from: 'kg', to: 'gram', f: '1000' },
    { id: id('CNV', 2), item: 'ITM-005', from: 'liter', to: 'ml', f: '1000' },
    { id: id('CNV', 3), item: 'ITM-013', from: 'sak', to: 'kg', f: '25' },
    { id: id('CNV', 4), item: 'ITM-021', from: 'pack', to: 'pcs', f: '50' },
    { id: id('CNV', 5), item: 'ITM-022', from: 'sleeve', to: 'pcs', f: '50' }
  ];
  await appendBatched(TABS.unitConversion, convs.map((c) => ({
    conversion_id: c.id, item_id: c.item, from_unit: c.from, to_unit: c.to,
    conversion_factor: c.f, active_status: 'active', created_at: now
  })));

  // Thresholds
  const thresholds = ITEMS.filter((i) => i.crit === 'CRITICAL' || i.crit === 'HIGH').map((it, i) => ({
    threshold_id: id('THR', i + 1),
    brand_id: 'BR-001', outlet_id: 'OL-001', location_id: outletWarehouses[0]?.location_id || 'LOC-001',
    item_id: it.id, threshold_type: 'WASTE_DAILY_VALUE',
    warning_value: String(it.price * 2), high_value: String(it.price * 5), critical_value: String(it.price * 10),
    unit: 'IDR', active_status: 'active', updated_by: 'USR-001', updated_at: now
  }));
  await appendBatched(TABS.inventoryThreshold, thresholds);

  // ── 30 days of transactions ──
  const movements: Record<string, string>[] = [];
  const receivings: Record<string, string>[] = [];
  const recvItems: Record<string, string>[] = [];
  const issues: Record<string, string>[] = [];
  const issueItems: Record<string, string>[] = [];
  const wastes: Record<string, string>[] = [];
  const transfers: Record<string, string>[] = [];
  const transferItems: Record<string, string>[] = [];
  const counts: Record<string, string>[] = [];
  const countItems: Record<string, string>[] = [];
  const batches: Record<string, string>[] = [];
  const alerts: Record<string, string>[] = [];
  const actions: Record<string, string>[] = [];
  const recs: Record<string, string>[] = [];
  const summaries: Record<string, string>[] = [];
  const adjustments: Record<string, string>[] = [];

  // stock tracker per item@location for ledger continuity
  const stock = new Map<string, number>();
  const stockKey = (item: string, loc: string) => `${item}@${loc}`;

  let mvN = 1, rcvN = 1, isuN = 1, wstN = 1, trfN = 1, cntN = 1, batN = 1, alrN = 1, actN = 1, prcN = 1, adjN = 1;

  // Opening balances for all items at each outlet warehouse
  const openLocs = allLocs.filter((l) =>
    l.location_type === 'OUTLET_WAREHOUSE' || l.location_type === 'CHILLER' || l.location_type === 'CENTRAL_WAREHOUSE'
  ).slice(0, 12);

  for (const loc of openLocs) {
    for (const it of ITEMS) {
      const qty = Math.round(it.min + Math.random() * (it.max - it.min) * 0.6);
      const key = stockKey(it.id, loc.location_id);
      stock.set(key, qty);
      const mid = id('MV', mvN++);
      movements.push({
        movement_id: mid, movement_number: mid, movement_datetime: `${dayOffset(30)} 06:00:00`,
        item_id: it.id, brand_id: loc.brand_id, outlet_id: loc.outlet_id, location_id: loc.location_id,
        movement_type: 'OPENING_BALANCE', direction: 'IN', quantity: String(qty), base_unit: it.unit,
        unit_cost: String(it.price), total_value: String(qty * it.price),
        reference_type: 'opening_balance', reference_id: id('OPB', mvN),
        source_location_id: '', destination_location_id: loc.location_id,
        stock_before: '0', stock_after: String(qty),
        created_by: 'USR-001', approved_by: 'USR-001', notes: 'MEGA seed opening',
        environment: 'TESTING', created_at: now
      });
    }
  }

  // Daily activity for 30 days
  for (let day = 29; day >= 0; day--) {
    const date = dayOffset(day);
    const activeOutlets = OUTLETS.slice(0, 5); // 5 outlets active daily

    for (const outlet of activeOutlets) {
      const loc = allLocs.find((l) => l.outlet_id === outlet.id && l.location_type === 'OUTLET_WAREHOUSE')
        || allLocs.find((l) => l.outlet_id === outlet.id)
        || openLocs[0];
      if (!loc) continue;

      // 3–6 receivings per outlet per day
      const nRecv = 3 + Math.floor(Math.random() * 4);
      for (let r = 0; r < nRecv; r++) {
        const it = ITEMS[Math.floor(Math.random() * ITEMS.length)];
        const qtyOrder = Math.ceil(it.usage * (2 + Math.random() * 3));
        const discrepancy = Math.random() < 0.12; // 12% discrepancy rate
        const qtyAccepted = discrepancy ? Math.max(0, qtyOrder - 1 - Math.floor(Math.random() * 2)) : qtyOrder;
        const rid = id('RCV', rcvN++);
        const status = discrepancy ? 'DISCREPANCY' : 'RECEIVED';
        const condition = discrepancy && Math.random() < 0.3 ? 'DAMAGED' : 'GOOD';
        receivings.push({
          receiving_id: rid, receiving_number: rid, date, receiving_time: `${8 + r}:30:00`,
          source_type: 'SUPPLIER', supplier_id: it.sup, source_location_id: '',
          destination_location_id: loc.location_id, purchase_order_id: `PO-${date.replace(/-/g, '')}-${r}`,
          invoice_number: `INV-${pad(rcvN, 5)}`, delivery_note_number: `DN-${pad(rcvN, 5)}`,
          received_by: 'USR-MEGA-004', verified_by: 'USR-MEGA-001', receiving_status: status,
          photo_url: '', notes: discrepancy ? 'MEGA seed discrepancy' : 'MEGA seed',
          created_at: `${date} 08:30:00`, approved_at: `${date} 09:00:00`
        });
        const riid = id('RCI', rcvN);
        recvItems.push({
          receiving_item_id: riid, receiving_id: rid, item_id: it.id,
          batch_number: `B${date.replace(/-/g, '')}-${it.id.slice(-3)}`,
          expiry_date: dayOffset(-it.exp + Math.floor(Math.random() * 3)),
          qty_ordered: String(qtyOrder), qty_delivered: String(qtyOrder),
          qty_accepted: String(qtyAccepted), qty_rejected: String(qtyOrder - qtyAccepted),
          unit: it.unit, unit_price: String(it.price), total_value: String(qtyAccepted * it.price),
          rejection_reason: discrepancy ? 'Qty short / condition' : '',
          condition_status: condition, temperature_value: it.cat === 'CAT-001' || it.cat === 'CAT-004' ? '2.5' : '',
          photo_url: '', notes: ''
        });
        // batch stock
        batches.push({
          batch_stock_id: id('BAT', batN++), item_id: it.id, location_id: loc.location_id,
          batch_number: `B${date.replace(/-/g, '')}-${it.id.slice(-3)}`,
          expiry_date: dayOffset(-it.exp + Math.floor(Math.random() * 3)),
          received_date: date, current_qty: String(qtyAccepted), unit: it.unit,
          unit_cost: String(it.price),
          status: it.exp <= 3 ? 'NEAR_EXPIRY' : 'ACTIVE',
          created_at: now, updated_at: now
        });
        // ledger RECEIPT
        const key = stockKey(it.id, loc.location_id);
        const before = stock.get(key) ?? 0;
        const after = before + qtyAccepted;
        stock.set(key, after);
        const mid = id('MV', mvN++);
        movements.push({
          movement_id: mid, movement_number: mid, movement_datetime: `${date} 0${8 + r}:35:00`,
          item_id: it.id, brand_id: outlet.brand, outlet_id: outlet.id, location_id: loc.location_id,
          movement_type: 'RECEIPT', direction: 'IN', quantity: String(qtyAccepted), base_unit: it.unit,
          unit_cost: String(it.price), total_value: String(qtyAccepted * it.price),
          reference_type: 'receiving', reference_id: rid,
          source_location_id: '', destination_location_id: loc.location_id,
          stock_before: String(before), stock_after: String(after),
          created_by: 'USR-MEGA-004', approved_by: 'USR-MEGA-001', notes: 'MEGA seed receipt',
          environment: 'TESTING', created_at: now
        });
        if (discrepancy) {
          const aid = id('ALR', alrN++);
          alerts.push({
            alert_id: aid, alert_datetime: `${date} 09:05:00`, alert_type: 'RECEIVING_DISCREPANCY',
            severity: condition === 'DAMAGED' ? 'HIGH' : 'MEDIUM',
            brand_id: outlet.brand, outlet_id: outlet.id, location_id: loc.location_id, item_id: it.id,
            reference_type: 'receiving', reference_id: rid,
            title: `Receiving discrepancy: ${it.name}`,
            message: `Ordered ${qtyOrder}, accepted ${qtyAccepted}, condition ${condition}`,
            status: day < 3 ? 'OPEN' : 'RESOLVED', assigned_to: 'USR-MEGA-002', due_date: date,
            action_required: 'Claim to supplier', telegram_status: day < 3 ? 'QUEUED' : 'SENT',
            created_at: now, resolved_at: day < 3 ? '' : `${date} 15:00:00`, resolved_by: day < 3 ? '' : 'USR-MEGA-002'
          });
          if (condition === 'DAMAGED' || qtyAccepted < qtyOrder * 0.9) {
            actions.push({
              action_id: id('ACT', actN++), source_alert_id: aid,
              title: `Claim ${it.name} discrepancy`, description: `PO short/damaged at ${outlet.name}`,
              brand_id: outlet.brand, outlet_id: outlet.id, location_id: loc.location_id, item_id: it.id,
              priority: 'HIGH', assigned_to: 'USR-MEGA-002', assigned_role: 'purchasing',
              due_date: date, status: day < 3 ? 'OPEN' : 'DONE', action_taken: day < 3 ? '' : 'Claimed to supplier',
              attachment_url: '', approved_by: '', created_at: now, updated_at: now, completed_at: day < 3 ? '' : `${date} 16:00:00`
            });
          }
        }
      }

      // 4–8 stock issues per outlet per day
      const nIssue = 4 + Math.floor(Math.random() * 5);
      for (let i = 0; i < nIssue; i++) {
        const it = ITEMS[Math.floor(Math.random() * 15)]; // prefer top items
        const qty = Math.max(1, Math.round(it.usage * (0.3 + Math.random() * 0.8)));
        const iid = id('ISU', isuN++);
        const kitLoc = allLocs.find((l) => l.outlet_id === outlet.id && l.location_type === 'KITCHEN');
        issues.push({
          issue_id: iid, issue_number: iid, date, shift_id: i % 2 === 0 ? 'SHIFT-A' : 'SHIFT-B',
          brand_id: outlet.brand, outlet_id: outlet.id,
          source_location_id: loc.location_id, destination_location_id: kitLoc?.location_id || '',
          issue_type: i % 3 === 0 ? 'PRODUCTION_BATCH' : 'SHIFT_ISSUE',
          requested_by: 'USR-MEGA-005', issued_by: 'USR-MEGA-004', received_by: 'USR-MEGA-005',
          approval_status: 'APPROVED', notes: 'MEGA seed issue',
          created_at: `${date} 10:00:00`, approved_at: `${date} 10:05:00`
        });
        issueItems.push({
          issue_item_id: id('ISI', isuN), issue_id: iid, item_id: it.id,
          requested_qty: String(qty), issued_qty: String(qty), unit: it.unit,
          batch_reference: '', purpose: 'Kitchen production', notes: ''
        });
        const key = stockKey(it.id, loc.location_id);
        const before = stock.get(key) ?? 0;
        const after = Math.max(0, before - qty);
        stock.set(key, after);
        const mid = id('MV', mvN++);
        movements.push({
          movement_id: mid, movement_number: mid, movement_datetime: `${date} 10:${pad(i, 2)}:00`,
          item_id: it.id, brand_id: outlet.brand, outlet_id: outlet.id, location_id: loc.location_id,
          movement_type: 'ISSUE', direction: 'OUT', quantity: String(qty), base_unit: it.unit,
          unit_cost: String(it.price), total_value: String(qty * it.price),
          reference_type: 'stock_issue', reference_id: iid,
          source_location_id: loc.location_id, destination_location_id: kitLoc?.location_id || '',
          stock_before: String(before), stock_after: String(after),
          created_by: 'USR-MEGA-004', approved_by: 'USR-MEGA-001', notes: 'MEGA seed issue',
          environment: 'TESTING', created_at: now
        });
        // low stock alert
        if (after <= it.min) {
          const sev = after <= 0 ? 'CRITICAL' : 'HIGH';
          const aid = id('ALR', alrN++);
          alerts.push({
            alert_id: aid, alert_datetime: `${date} 10:30:00`,
            alert_type: after <= 0 ? 'STOCKOUT_RISK' : 'LOW_STOCK',
            severity: sev, brand_id: outlet.brand, outlet_id: outlet.id,
            location_id: loc.location_id, item_id: it.id,
            reference_type: 'stock_issue', reference_id: iid,
            title: `${after <= 0 ? 'Stockout' : 'Low stock'}: ${it.name}`,
            message: `Available ${after} ${it.unit} at ${outlet.name} (min ${it.min})`,
            status: day < 2 ? 'OPEN' : 'ACKNOWLEDGED', assigned_to: 'USR-MEGA-002', due_date: date,
            action_required: 'Create purchase recommendation', telegram_status: 'QUEUED',
            created_at: now, resolved_at: '', resolved_by: ''
          });
        }
      }

      // 1–3 waste per outlet per day
      const nWaste = 1 + Math.floor(Math.random() * 3);
      for (let w = 0; w < nWaste; w++) {
        const it = ITEMS[Math.floor(Math.random() * 10)];
        const qty = Math.max(0.5, Math.round(Math.random() * 3 * 10) / 10);
        const wid = id('WST', wstN++);
        const wtypes = ['EXPIRED', 'SPOILED', 'OVERPRODUCTION', 'SPILL', 'QC_REJECT', 'PORTION_ERROR'];
        const wtype = wtypes[Math.floor(Math.random() * wtypes.length)];
        wastes.push({
          waste_id: wid, waste_number: wid, date, time: `${20 + w}:15:00`,
          brand_id: outlet.brand, outlet_id: outlet.id, location_id: loc.location_id,
          shift_id: 'SHIFT-B', item_id: it.id, menu_id: '', batch_reference: '',
          qty: String(qty), unit: it.unit, estimated_unit_cost: String(it.price),
          estimated_total_value: String(Math.round(qty * it.price)),
          waste_type: wtype, reason: `MEGA ${wtype}`, root_cause: 'Process variance',
          photo_url: `https://picsum.photos/seed/${wid}/400/300`,
          reported_by: 'USR-MEGA-006', witness_by: 'USR-MEGA-004',
          approval_status: qty * it.price > it.price * 2 ? 'PENDING' : 'APPROVED',
          approved_by: qty * it.price > it.price * 2 ? '' : 'USR-MEGA-001',
          related_order_id: '', related_incident_id: '',
          preventive_action: 'Retrain portion control', created_at: `${date} 20:15:00`
        });
        const key = stockKey(it.id, loc.location_id);
        const before = stock.get(key) ?? 0;
        const after = Math.max(0, before - qty);
        stock.set(key, after);
        const mid = id('MV', mvN++);
        movements.push({
          movement_id: mid, movement_number: mid, movement_datetime: `${date} 20:${pad(w, 2)}:00`,
          item_id: it.id, brand_id: outlet.brand, outlet_id: outlet.id, location_id: loc.location_id,
          movement_type: 'WASTE', direction: 'OUT', quantity: String(qty), base_unit: it.unit,
          unit_cost: String(it.price), total_value: String(Math.round(qty * it.price)),
          reference_type: 'waste', reference_id: wid,
          source_location_id: loc.location_id, destination_location_id: '',
          stock_before: String(before), stock_after: String(after),
          created_by: 'USR-MEGA-006', approved_by: 'USR-MEGA-001', notes: `MEGA waste ${wtype}`,
          environment: 'TESTING', created_at: now
        });
      }
    }

    // Transfers every 3 days between outlets
    if (day % 3 === 0) {
      const from = OUTLETS[0];
      const to = OUTLETS[1];
      const fromLoc = allLocs.find((l) => l.outlet_id === from.id && l.location_type === 'OUTLET_WAREHOUSE');
      const toLoc = allLocs.find((l) => l.outlet_id === to.id && l.location_type === 'OUTLET_WAREHOUSE');
      if (fromLoc && toLoc) {
        const it = ITEMS[Math.floor(Math.random() * 5)];
        const qty = 5 + Math.floor(Math.random() * 10);
        const tid = id('TRF', trfN++);
        const disc = Math.random() < 0.15;
        const received = disc ? qty - 1 : qty;
        transfers.push({
          transfer_id: tid, transfer_number: tid, date,
          source_location_id: fromLoc.location_id, destination_location_id: toLoc.location_id,
          requested_by: 'USR-MEGA-003', approved_by: 'USR-001', dispatched_by: 'USR-MEGA-004',
          received_by: 'USR-MEGA-004', dispatch_time: `${date} 11:00:00`,
          received_time: `${date} 14:00:00`,
          status: disc ? 'DISCREPANCY' : 'RECEIVED', notes: 'MEGA inter-outlet transfer',
          created_at: now, updated_at: now
        });
        transferItems.push({
          transfer_item_id: id('TRI', trfN), transfer_id: tid, item_id: it.id,
          requested_qty: String(qty), dispatched_qty: String(qty), received_qty: String(received),
          unit: it.unit, discrepancy_qty: String(received - qty),
          discrepancy_reason: disc ? 'Missing 1 unit on receive' : '', photo_url: ''
        });
        // OUT
        const k1 = stockKey(it.id, fromLoc.location_id);
        const b1 = stock.get(k1) ?? 0;
        stock.set(k1, Math.max(0, b1 - qty));
        movements.push({
          movement_id: id('MV', mvN++), movement_number: id('MV', mvN), movement_datetime: `${date} 11:00:00`,
          item_id: it.id, brand_id: from.brand, outlet_id: from.id, location_id: fromLoc.location_id,
          movement_type: 'TRANSFER_OUT', direction: 'OUT', quantity: String(qty), base_unit: it.unit,
          unit_cost: String(it.price), total_value: String(qty * it.price),
          reference_type: 'transfer', reference_id: tid,
          source_location_id: fromLoc.location_id, destination_location_id: toLoc.location_id,
          stock_before: String(b1), stock_after: String(Math.max(0, b1 - qty)),
          created_by: 'USR-MEGA-004', approved_by: 'USR-001', notes: 'MEGA transfer out',
          environment: 'TESTING', created_at: now
        });
        // IN
        const k2 = stockKey(it.id, toLoc.location_id);
        const b2 = stock.get(k2) ?? 0;
        stock.set(k2, b2 + received);
        movements.push({
          movement_id: id('MV', mvN++), movement_number: id('MV', mvN), movement_datetime: `${date} 14:00:00`,
          item_id: it.id, brand_id: to.brand, outlet_id: to.id, location_id: toLoc.location_id,
          movement_type: 'TRANSFER_IN', direction: 'IN', quantity: String(received), base_unit: it.unit,
          unit_cost: String(it.price), total_value: String(received * it.price),
          reference_type: 'transfer', reference_id: tid,
          source_location_id: fromLoc.location_id, destination_location_id: toLoc.location_id,
          stock_before: String(b2), stock_after: String(b2 + received),
          created_by: 'USR-MEGA-004', approved_by: 'USR-001', notes: 'MEGA transfer in',
          environment: 'TESTING', created_at: now
        });
      }
    }

    // Stock opname every 7 days
    if (day % 7 === 0) {
      const outlet = OUTLETS[0];
      const loc = allLocs.find((l) => l.outlet_id === outlet.id && l.location_type === 'OUTLET_WAREHOUSE');
      if (loc) {
        const cid = id('CNT', cntN++);
        counts.push({
          count_id: cid, count_number: cid, count_date: date, count_type: 'WEEKLY',
          brand_id: outlet.brand, outlet_id: outlet.id, location_id: loc.location_id,
          status: 'COMPLETED', counted_by: 'USR-MEGA-004', verified_by: 'USR-MEGA-001',
          approved_by: 'USR-001', created_at: now, completed_at: `${date} 22:30:00`
        });
        for (const it of ITEMS.slice(0, 12)) {
          const key = stockKey(it.id, loc.location_id);
          const book = stock.get(key) ?? 0;
          const variance = Math.random() < 0.25 ? (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 2) : 0;
          const physical = Math.max(0, Math.round((book + variance) * 10) / 10);
          const varQty = physical - book;
          const varPct = book > 0 ? Math.abs(varQty / book) * 100 : 0;
          const varVal = Math.round(Math.abs(varQty) * it.price);
          const severity = varPct > 10 ? 'CRITICAL' : varPct > 5 ? 'HIGH' : varPct > 2 ? 'WARNING' : 'NORMAL';
          countItems.push({
            count_item_id: id('CNI', cntN), count_id: cid, item_id: it.id,
            book_stock: String(book), theoretical_stock: String(book), physical_stock: String(physical),
            base_unit: it.unit, variance_vs_book_qty: String(varQty),
            variance_vs_book_percentage: varPct.toFixed(1), variance_vs_book_value: String(varVal),
            variance_vs_theoretical_qty: String(varQty), tolerance_percentage: '5', tolerance_value: String(it.price * 2),
            severity, recount_required: severity === 'HIGH' || severity === 'CRITICAL' ? 'Y' : 'N',
            recount_result: '', root_cause: varQty !== 0 ? 'Unexplained stock variance' : '',
            investigation_status: varPct > 5 ? 'OPEN' : 'NOT_REQUIRED',
            assigned_to: varPct > 5 ? 'USR-MEGA-004' : '', due_date: varPct > 5 ? date : '',
            approval_status: varPct > 5 ? 'PENDING' : 'NOT_REQUIRED', notes: 'MEGA opname'
          });
          if (varPct > 5) {
            alerts.push({
              alert_id: id('ALR', alrN++), alert_datetime: `${date} 22:35:00`,
              alert_type: 'STOCK_VARIANCE', severity,
              brand_id: outlet.brand, outlet_id: outlet.id, location_id: loc.location_id, item_id: it.id,
              reference_type: 'stock_count', reference_id: cid,
              title: `Unexplained stock variance: ${it.name}`,
              message: `Book ${book}, physical ${physical}, variance ${varQty} (${varPct.toFixed(1)}%, Rp ${varVal})`,
              status: 'OPEN', assigned_to: 'USR-MEGA-004', due_date: date,
              action_required: 'Recount before confirming loss', telegram_status: 'QUEUED',
              created_at: now, resolved_at: '', resolved_by: ''
            });
          }
        }
      }
    }

    // Daily summary per active brand
    for (const brand of BRANDS.slice(0, 3)) {
      const brandOutlets = activeOutlets.filter((o) => o.brand === brand.id);
      for (const o of brandOutlets) {
        summaries.push({
          summary_id: id('WHS', Number(`${29 - day}${brand.id.slice(-1)}${o.id.slice(-1)}`)),
          date, brand_id: brand.id, brand_name: brand.name, outlet_id: o.id, outlet_name: o.name,
          location_id: '', total_inventory_value: String(50_000_000 + Math.floor(Math.random() * 20_000_000)),
          critical_low_stock_count: String(Math.floor(Math.random() * 4)),
          stockout_risk_count: String(Math.floor(Math.random() * 2)),
          purchase_recommendation_count: String(3 + Math.floor(Math.random() * 8)),
          estimated_purchase_value: String(1_000_000 + Math.floor(Math.random() * 5_000_000)),
          pending_purchase_request_count: String(Math.floor(Math.random() * 3)),
          pending_receiving_count: String(Math.floor(Math.random() * 2)),
          receiving_discrepancy_count: String(Math.floor(Math.random() * 2)),
          pending_transfer_count: String(Math.floor(Math.random() * 2)),
          transfer_discrepancy_count: String(Math.random() < 0.2 ? 1 : 0),
          waste_item_count: String(1 + Math.floor(Math.random() * 4)),
          waste_value: String(50_000 + Math.floor(Math.random() * 400_000)),
          variance_item_count: String(Math.floor(Math.random() * 3)),
          unexplained_variance_value: String(Math.floor(Math.random() * 300_000)),
          near_expiry_item_count: String(Math.floor(Math.random() * 5)),
          expired_item_count: String(Math.random() < 0.2 ? 1 : 0),
          open_action_count: String(Math.floor(Math.random() * 6)),
          overdue_action_count: String(Math.floor(Math.random() * 2)),
          major_warehouse_issue: Math.random() < 0.3 ? 'Low stock protein + receiving discrepancy' : '',
          recommended_action: Math.random() < 0.3 ? 'Confirm PO ayam & recount daging' : '',
          generated_at: `${date} 22:00:00`
        });
      }
    }
  }

  // Purchase recommendations (today snapshot for all CRITICAL/HIGH items)
  for (const it of ITEMS.filter((i) => i.crit === 'CRITICAL' || i.crit === 'HIGH')) {
    for (const o of OUTLETS.slice(0, 4)) {
      const loc = allLocs.find((l) => l.outlet_id === o.id && l.location_type === 'OUTLET_WAREHOUSE');
      if (!loc) continue;
      const avail = stock.get(stockKey(it.id, loc.location_id)) ?? 0;
      const reorder = it.usage * it.lead + it.safety;
      const daysCover = it.usage > 0 ? avail / it.usage : 0;
      const suggested = Math.max(0, it.max - avail);
      const rounded = Math.ceil(suggested / Math.max(1, it.min / 2)) * Math.max(1, Math.ceil(it.min / 2));
      const prio = avail <= 0 || daysCover < it.lead ? 'CRITICAL' : avail <= reorder ? 'HIGH' : 'MEDIUM';
      if (prio === 'MEDIUM' && suggested === 0) continue;
      recs.push({
        recommendation_id: id('PRC', prcN++), date: dayOffset(0), item_id: it.id, item_name: it.name,
        brand_id: o.brand, outlet_id: o.id, location_id: loc.location_id,
        available_stock: String(avail), average_daily_usage: String(it.usage),
        days_of_cover: daysCover.toFixed(1), reorder_point: String(reorder),
        maximum_stock: String(it.max), incoming_po_qty: '0', reserved_qty: '0',
        suggested_purchase_qty: String(suggested), rounded_purchase_qty: String(rounded),
        purchase_unit: it.unit, supplier_id: it.sup,
        supplier_name: SUPPLIERS.find((s) => s.id === it.sup)?.name || '',
        estimated_unit_price: String(it.price), estimated_purchase_value: String(rounded * it.price),
        required_by_date: dayOffset(-it.lead), priority: prio,
        reason: prio === 'CRITICAL' ? 'Days of cover < lead time' : 'Available <= reorder point',
        recommendation_status: 'NEW', created_at: now, approved_by: '', approved_at: ''
      });
    }
  }

  // A few adjustments
  for (let i = 0; i < 8; i++) {
    const it = ITEMS[i];
    const loc = openLocs[i % openLocs.length];
    adjustments.push({
      adjustment_id: id('ADJ', adjN++), date: dayOffset(i % 10),
      item_id: it.id, location_id: loc.location_id,
      adjustment_type: i % 2 === 0 ? 'COUNT_CORRECTION' : 'OPENING_BALANCE_FIX',
      qty_difference: String((Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random())),
      unit: it.unit, reason: 'MEGA seed adjustment', reference_count_id: '',
      requested_by: 'USR-MEGA-001', approved_by: i < 5 ? 'USR-001' : '',
      approval_status: i < 5 ? 'APPROVED' : 'PENDING', created_at: now
    });
  }

  console.log('[mega-seed] writing transactional data…');
  console.log({
    movements: movements.length, receivings: receivings.length, recvItems: recvItems.length,
    issues: issues.length, wastes: wastes.length, transfers: transfers.length,
    counts: counts.length, countItems: countItems.length, batches: batches.length,
    alerts: alerts.length, actions: actions.length, recs: recs.length,
    summaries: summaries.length, adjustments: adjustments.length
  });

  await appendBatched(TABS.stockMovement, movements, 50);
  await appendBatched(TABS.receiving, receivings, 40);
  await appendBatched(TABS.receivingItem, recvItems, 40);
  await appendBatched(TABS.stockIssue, issues, 40);
  await appendBatched(TABS.stockIssueItem, issueItems, 40);
  await appendBatched(TABS.waste, wastes, 40);
  await appendBatched(TABS.transfer, transfers, 30);
  await appendBatched(TABS.transferItem, transferItems, 30);
  await appendBatched(TABS.stockCount, counts, 20);
  await appendBatched(TABS.stockCountItem, countItems, 40);
  await appendBatched(TABS.batchStock, batches, 40);
  await appendBatched(TABS.alertLog, alerts, 40);
  await appendBatched(TABS.actionTracker, actions, 30);
  await appendBatched(TABS.purchaseRecommendation, recs, 30);
  await appendBatched(TABS.dailySummary, summaries, 40);
  await appendBatched(TABS.adjustment, adjustments, 20);

  console.log('[mega-seed] DONE');
  console.log('Login demo users (password in seed):');
  console.log('  owner/owner123 | wh_admin/admin123 | purchasing/purchase123');
  console.log('  fkd_mgr/manager123 | cipete_pic/pic12345 | staff1/staff123');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
