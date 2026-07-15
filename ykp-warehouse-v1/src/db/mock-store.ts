/**
 * In-memory mock DB for local demo / Playwright.
 * Self-contained (no import from sheets.ts) to avoid circular deps.
 * Activated when USE_MOCK_DB=true or Google Sheets env is missing.
 *
 * Schema matches sheets.ts TABS — full Warehouse V1 brief.
 */
import { createHash } from 'crypto';

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

// String keys must match TABS values in sheets.ts
const TAB = {
  brands: 'master_brand',
  outlets: 'master_outlet',
  items: 'master_item',
  suppliers: 'master_supplier',
  locations: 'master_location',
  unitConversion: 'master_unit_conversion',
  itemCategory: 'master_item_category',
  inventoryThreshold: 'master_inventory_threshold',
  stockMovement: 'warehouse_stock_movement',
  receiving: 'warehouse_receiving',
  receivingItem: 'warehouse_receiving_item',
  stockIssue: 'warehouse_stock_issue',
  stockIssueItem: 'warehouse_stock_issue_item',
  waste: 'warehouse_waste',
  adjustment: 'warehouse_stock_adjustment',
  transfer: 'warehouse_transfer',
  transferItem: 'warehouse_transfer_item',
  stockCount: 'warehouse_stock_count',
  stockCountItem: 'warehouse_stock_count_item',
  batchStock: 'warehouse_batch_stock',
  purchaseRecommendation: 'warehouse_purchase_recommendation',
  purchaseRequest: 'warehouse_purchase_request',
  purchaseRequestItem: 'warehouse_purchase_request_item',
  alertLog: 'warehouse_alert_log',
  actionTracker: 'warehouse_action_tracker',
  dailySummary: 'warehouse_daily_summary',
  telegramDeliveryLog: 'telegram_delivery_log',
  users: 'users',
  auditLog: 'system_audit_log',
  legacyPenerimaan: 'f1_penerimaan',
  legacyKartuStok: 'f2_kartu_stok',
  legacyPemakaian: 'f3_bon_pemakaian',
  legacyWaste: 'f4_waste',
  legacyClosing: 'f5_closing',
  legacyDashboard: 'dashboard',
  legacyAlerts: 'hermes_alert_log'
} as const;

function seed(): Record<string, Record<string, string>[]> {
  const pw = createHash('sha256').update('owner123').digest('hex');
  const t = now();
  return {
    [TAB.brands]: [
      { brand_id: 'BR-001', brand_name: 'Funkydak', brand_code: 'FKD', status: 'active', created_at: t, updated_at: t },
      { brand_id: 'BR-002', brand_name: 'Sekarpizza', brand_code: 'SKP', status: 'active', created_at: t, updated_at: t },
      { brand_id: 'BR-003', brand_name: 'Suburbuns', brand_code: 'SBN', status: 'active', created_at: t, updated_at: t },
      { brand_id: 'BR-004', brand_name: 'Laju Kopi', brand_code: 'LJK', status: 'active', created_at: t, updated_at: t },
      { brand_id: 'BR-005', brand_name: 'Uncle Masala', brand_code: 'UMS', status: 'active', created_at: t, updated_at: t }
    ],
    [TAB.outlets]: [
      { outlet_id: 'OL-001', brand_id: 'BR-001', outlet_name: 'Funkydak Cipete', outlet_code: 'FKD-01', address: 'Cipete Raya', status: 'active', created_at: t, updated_at: t }
    ],
    // §8.1 — 10 critical items with full 32 columns
    [TAB.items]: [
      { item_id: 'ITM-001', item_code: 'ITM-001', item_name: 'Daging Sapi Sirloin', brand_id: 'BR-001', category_id: 'CAT-001', item_type: 'RAW_MATERIAL', base_unit: 'kg', purchase_unit: 'kg', conversion_factor: '1', pack_size: '1', minimum_order_quantity: '5', preferred_supplier_id: 'SUP-001', backup_supplier_id: '', latest_purchase_price: '180000', average_purchase_price: '175000', minimum_stock: '5', safety_stock: '3', maximum_stock: '25', reorder_point: '13', average_daily_usage: '5', supplier_lead_time_days: '2', supplier_order_day: '1', supplier_delivery_day: '3', expiry_days: '5', criticality: 'CRITICAL', tolerance_variance_percentage: '2', tolerance_variance_value: '500000', recipe_linked_status: 'YES', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { item_id: 'ITM-002', item_code: 'ITM-002', item_name: 'Ayam Fillet', brand_id: 'BR-001', category_id: 'CAT-001', item_type: 'RAW_MATERIAL', base_unit: 'kg', purchase_unit: 'kg', conversion_factor: '1', pack_size: '1', minimum_order_quantity: '10', preferred_supplier_id: 'SUP-001', backup_supplier_id: '', latest_purchase_price: '55000', average_purchase_price: '53000', minimum_stock: '10', safety_stock: '5', maximum_stock: '40', reorder_point: '27', average_daily_usage: '11', supplier_lead_time_days: '2', supplier_order_day: '1', supplier_delivery_day: '3', expiry_days: '3', criticality: 'CRITICAL', tolerance_variance_percentage: '3', tolerance_variance_value: '300000', recipe_linked_status: 'YES', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { item_id: 'ITM-003', item_code: 'ITM-003', item_name: 'Salmon Fillet', brand_id: 'BR-001', category_id: 'CAT-001', item_type: 'RAW_MATERIAL', base_unit: 'kg', purchase_unit: 'kg', conversion_factor: '1', pack_size: '1', minimum_order_quantity: '2', preferred_supplier_id: 'SUP-001', backup_supplier_id: '', latest_purchase_price: '320000', average_purchase_price: '315000', minimum_stock: '3', safety_stock: '2', maximum_stock: '12', reorder_point: '8', average_daily_usage: '3', supplier_lead_time_days: '2', supplier_order_day: '1', supplier_delivery_day: '3', expiry_days: '3', criticality: 'HIGH', tolerance_variance_percentage: '2', tolerance_variance_value: '400000', recipe_linked_status: 'YES', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { item_id: 'ITM-004', item_code: 'ITM-004', item_name: 'Keju Mozzarella', brand_id: 'BR-001', category_id: 'CAT-002', item_type: 'RAW_MATERIAL', base_unit: 'kg', purchase_unit: 'kg', conversion_factor: '1', pack_size: '1', minimum_order_quantity: '3', preferred_supplier_id: 'SUP-001', backup_supplier_id: '', latest_purchase_price: '145000', average_purchase_price: '142000', minimum_stock: '4', safety_stock: '2', maximum_stock: '15', reorder_point: '8', average_daily_usage: '3', supplier_lead_time_days: '2', supplier_order_day: '1', supplier_delivery_day: '3', expiry_days: '7', criticality: 'HIGH', tolerance_variance_percentage: '3', tolerance_variance_value: '200000', recipe_linked_status: 'YES', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { item_id: 'ITM-005', item_code: 'ITM-005', item_name: 'Minyak Goreng', brand_id: 'BR-001', category_id: 'CAT-003', item_type: 'RAW_MATERIAL', base_unit: 'liter', purchase_unit: 'liter', conversion_factor: '1', pack_size: '1', minimum_order_quantity: '20', preferred_supplier_id: 'SUP-002', backup_supplier_id: '', latest_purchase_price: '18000', average_purchase_price: '17500', minimum_stock: '20', safety_stock: '10', maximum_stock: '60', reorder_point: '30', average_daily_usage: '10', supplier_lead_time_days: '1', supplier_order_day: '1', supplier_delivery_day: '2', expiry_days: '90', criticality: 'MEDIUM', tolerance_variance_percentage: '5', tolerance_variance_value: '100000', recipe_linked_status: 'YES', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { item_id: 'ITM-006', item_code: 'ITM-006', item_name: 'Gula Pasir', brand_id: 'BR-001', category_id: 'CAT-003', item_type: 'RAW_MATERIAL', base_unit: 'kg', purchase_unit: 'kg', conversion_factor: '1', pack_size: '1', minimum_order_quantity: '10', preferred_supplier_id: 'SUP-002', backup_supplier_id: '', latest_purchase_price: '14000', average_purchase_price: '13800', minimum_stock: '15', safety_stock: '8', maximum_stock: '50', reorder_point: '23', average_daily_usage: '8', supplier_lead_time_days: '1', supplier_order_day: '1', supplier_delivery_day: '2', expiry_days: '180', criticality: 'MEDIUM', tolerance_variance_percentage: '3', tolerance_variance_value: '100000', recipe_linked_status: 'YES', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { item_id: 'ITM-007', item_code: 'ITM-007', item_name: 'Kopi Arabica Bean', brand_id: 'BR-001', category_id: 'CAT-003', item_type: 'RAW_MATERIAL', base_unit: 'kg', purchase_unit: 'kg', conversion_factor: '1', pack_size: '1', minimum_order_quantity: '3', preferred_supplier_id: 'SUP-002', backup_supplier_id: '', latest_purchase_price: '220000', average_purchase_price: '215000', minimum_stock: '5', safety_stock: '3', maximum_stock: '20', reorder_point: '10', average_daily_usage: '3.5', supplier_lead_time_days: '3', supplier_order_day: '1', supplier_delivery_day: '4', expiry_days: '60', criticality: 'HIGH', tolerance_variance_percentage: '2', tolerance_variance_value: '300000', recipe_linked_status: 'YES', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { item_id: 'ITM-008', item_code: 'ITM-008', item_name: 'Butter Unsalted', brand_id: 'BR-001', category_id: 'CAT-002', item_type: 'RAW_MATERIAL', base_unit: 'kg', purchase_unit: 'kg', conversion_factor: '1', pack_size: '1', minimum_order_quantity: '3', preferred_supplier_id: 'SUP-001', backup_supplier_id: '', latest_purchase_price: '95000', average_purchase_price: '92000', minimum_stock: '5', safety_stock: '3', maximum_stock: '15', reorder_point: '9', average_daily_usage: '3', supplier_lead_time_days: '2', supplier_order_day: '1', supplier_delivery_day: '3', expiry_days: '14', criticality: 'MEDIUM', tolerance_variance_percentage: '3', tolerance_variance_value: '150000', recipe_linked_status: 'YES', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { item_id: 'ITM-009', item_code: 'ITM-009', item_name: 'Udang Vaname', brand_id: 'BR-001', category_id: 'CAT-001', item_type: 'RAW_MATERIAL', base_unit: 'kg', purchase_unit: 'kg', conversion_factor: '1', pack_size: '1', minimum_order_quantity: '3', preferred_supplier_id: 'SUP-001', backup_supplier_id: '', latest_purchase_price: '110000', average_purchase_price: '108000', minimum_stock: '4', safety_stock: '2', maximum_stock: '15', reorder_point: '8', average_daily_usage: '3', supplier_lead_time_days: '2', supplier_order_day: '1', supplier_delivery_day: '3', expiry_days: '2', criticality: 'HIGH', tolerance_variance_percentage: '3', tolerance_variance_value: '200000', recipe_linked_status: 'YES', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { item_id: 'ITM-010', item_code: 'ITM-010', item_name: 'Cokelat Couverture', brand_id: 'BR-001', category_id: 'CAT-003', item_type: 'RAW_MATERIAL', base_unit: 'kg', purchase_unit: 'kg', conversion_factor: '1', pack_size: '1', minimum_order_quantity: '2', preferred_supplier_id: 'SUP-002', backup_supplier_id: '', latest_purchase_price: '165000', average_purchase_price: '160000', minimum_stock: '3', safety_stock: '2', maximum_stock: '10', reorder_point: '6', average_daily_usage: '2', supplier_lead_time_days: '3', supplier_order_day: '1', supplier_delivery_day: '4', expiry_days: '30', criticality: 'MEDIUM', tolerance_variance_percentage: '2', tolerance_variance_value: '200000', recipe_linked_status: 'YES', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' }
    ],
    // §8.3 — expanded supplier
    [TAB.suppliers]: [
      { supplier_id: 'SUP-001', supplier_code: 'SUP-001', supplier_name: 'Supplier Utama Daging', item_category: 'protein', phone: '081234000001', email: 'rahmat@supplier.com', address: 'Pasar Senen', bank_name: 'BCA', bank_account: '123456789', account_holder: 'Bpk. Rahmat', lead_time_days: '2', minimum_order_value: '500000', preferred_delivery_day: '3', active_status: 'active', created_at: t, updated_at: t },
      { supplier_id: 'SUP-002', supplier_code: 'SUP-002', supplier_name: 'Supplier Bahan Kering', item_category: 'dry', phone: '081234000002', email: 'sari@supplier.com', address: 'Pasar Induk', bank_name: 'Mandiri', bank_account: '987654321', account_holder: 'Ibu Sari', lead_time_days: '1', minimum_order_value: '300000', preferred_delivery_day: '2', active_status: 'active', created_at: t, updated_at: t }
    ],
    // §8.2 — locations
    [TAB.locations]: [
      { location_id: 'LOC-001', location_code: 'FKD-CW', location_name: 'Gudang Pusat Funkydak', brand_id: 'BR-001', outlet_id: '', location_type: 'CENTRAL_WAREHOUSE', parent_location_id: '', address: 'Cipete', active_status: 'active', created_at: t, updated_at: t },
      { location_id: 'LOC-002', location_code: 'FKD-KIT', location_name: 'Kitchen Funkydak Cipete', brand_id: 'BR-001', outlet_id: 'OL-001', location_type: 'KITCHEN', parent_location_id: 'LOC-001', address: 'Cipete', active_status: 'active', created_at: t, updated_at: t },
      { location_id: 'LOC-003', location_code: 'FKD-CHL', location_name: 'Chiller Funkydak Cipete', brand_id: 'BR-001', outlet_id: 'OL-001', location_type: 'CHILLER', parent_location_id: 'LOC-001', address: 'Cipete', active_status: 'active', created_at: t, updated_at: t },
      { location_id: 'LOC-004', location_code: 'FKD-DRY', location_name: 'Dry Storage Funkydak Cipete', brand_id: 'BR-001', outlet_id: 'OL-001', location_type: 'DRY_STORAGE', parent_location_id: 'LOC-001', address: 'Cipete', active_status: 'active', created_at: t, updated_at: t }
    ],
    // §8.4 — unit conversions
    [TAB.unitConversion]: [
      { conversion_id: 'CNV-001', item_id: 'ITM-001', from_unit: 'kg', to_unit: 'gram', conversion_factor: '1000', active_status: 'active', created_at: t },
      { conversion_id: 'CNV-002', item_id: 'ITM-005', from_unit: 'liter', to_unit: 'ml', conversion_factor: '1000', active_status: 'active', created_at: t }
    ],
    // §8.5 — item categories
    [TAB.itemCategory]: [
      { category_id: 'CAT-001', category_name: 'Protein', parent_category_id: '', active_status: 'active', created_at: t },
      { category_id: 'CAT-002', category_name: 'Dairy', parent_category_id: '', active_status: 'active', created_at: t },
      { category_id: 'CAT-003', category_name: 'Dry Goods', parent_category_id: '', active_status: 'active', created_at: t }
    ],
    // §8.6 — inventory thresholds
    [TAB.inventoryThreshold]: [
      { threshold_id: 'THR-001', brand_id: 'BR-001', outlet_id: 'OL-001', location_id: 'LOC-002', item_id: 'ITM-001', threshold_type: 'WASTE_DAILY_VALUE', warning_value: '200000', high_value: '500000', critical_value: '1000000', unit: 'IDR', active_status: 'active', updated_by: 'USR-001', updated_at: t }
    ],
    // ── Transactional tables (empty, filled at runtime) ─────────
    [TAB.stockMovement]: [],
    [TAB.receiving]: [],
    [TAB.receivingItem]: [],
    [TAB.stockIssue]: [],
    [TAB.stockIssueItem]: [],
    [TAB.waste]: [],
    [TAB.adjustment]: [],
    [TAB.transfer]: [],
    [TAB.transferItem]: [],
    [TAB.stockCount]: [],
    [TAB.stockCountItem]: [],
    [TAB.batchStock]: [],
    [TAB.purchaseRecommendation]: [],
    [TAB.purchaseRequest]: [],
    [TAB.purchaseRequestItem]: [],
    [TAB.alertLog]: [],
    [TAB.actionTracker]: [],
    [TAB.dailySummary]: [],
    [TAB.telegramDeliveryLog]: [],
    // ── Auth ────────────────────────────────────────────────────
    [TAB.users]: [
      { user_id: 'USR-001', username: 'owner', password_hash: pw, role: 'owner', brand_id: '', outlet_id: '', active_status: 'active', created_at: t, last_login_at: '' }
    ],
    [TAB.auditLog]: [],
    // ── Legacy (empty) ──────────────────────────────────────────
    [TAB.legacyPenerimaan]: [],
    [TAB.legacyKartuStok]: [],
    [TAB.legacyPemakaian]: [],
    [TAB.legacyWaste]: [],
    [TAB.legacyClosing]: [],
    [TAB.legacyDashboard]: [],
    [TAB.legacyAlerts]: []
  };
}

let store: Record<string, Record<string, string>[]> | null = null;
function getStore() {
  if (!store) store = seed();
  return store;
}

export function isMockMode(): boolean {
  if (process.env.USE_MOCK_DB === 'true') return true;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) return true;
  if (!process.env.YKP_WAREHOUSE_SPREADSHEET_ID) return true;
  return false;
}

export function mockReadTab(tab: string): Record<string, string>[] {
  return [...(getStore()[tab] ?? [])];
}

export function mockAppendRows(tab: string, rows: Record<string, string>[]): number {
  const s = getStore();
  if (!s[tab]) s[tab] = [];
  const start = s[tab].length + 2;
  s[tab].push(...rows.map((r) => ({ ...r })));
  return start;
}

export function mockUpdateRow(tab: string, rowNumber: number, values: Record<string, string>): void {
  const s = getStore();
  const idx = rowNumber - 2;
  if (idx < 0 || !s[tab]?.[idx]) throw new Error(`mock row ${rowNumber} not found in ${tab}`);
  s[tab][idx] = { ...s[tab][idx], ...values };
}

export function mockFindRow(
  tab: string,
  keyCol: string,
  value: string
): { rowNumber: number; row: Record<string, string> } | null {
  const rows = getStore()[tab] ?? [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][keyCol] === value) return { rowNumber: i + 2, row: { ...rows[i] } };
  }
  return null;
}
