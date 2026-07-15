/**
 * Google Sheets DB layer for YKP Warehouse & Inventory Control V1.
 *
 * One spreadsheet = "YKP_WAREHOUSE_V1". Each table = one tab. Header row is row 1,
 * data starts row 2. All writes go through batchUpdate/append to keep quota low.
 *
 * Schema follows YKP_ERP_Warehouse_Inventory_Developer_Brief_V1 §8-23:
 * master data (item/location/supplier/unit_conversion/item_category/threshold),
 * stock movement ledger (auto immutable), transactions (receiving/issue/waste/
 * adjustment/transfer/stock_count) as header+detail, batch stock (FEFO expiry),
 * purchase engine (recommendation/request), alerts + action tracker, daily
 * summary + telegram delivery log.
 *
 * Legacy F1-F5 tabs are kept for read migration only; all new writes go to the
 * structured tables. FK validation is done in the repository layer (lib/repo.ts).
 */
import { google, type sheets_v4 } from 'googleapis';
import { isMockMode, mockReadTab, mockAppendRows, mockUpdateRow, mockFindRow } from './mock-store';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let cached: sheets_v4.Sheets | null = null;

export function getSheetsClient(): sheets_v4.Sheets {
  if (cached) return cached;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !privateKey) {
    throw new Error(
      'Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env'
    );
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: SCOPES
  });
  cached = google.sheets({ version: 'v4', auth });
  return cached;
}

export function getSpreadsheetId(): string {
  const id = process.env.YKP_WAREHOUSE_SPREADSHEET_ID;
  if (!id) throw new Error('YKP_WAREHOUSE_SPREADSHEET_ID is not set in .env');
  return id;
}

/** All sheet/tab names. One tab per table. */
export const TABS = {
  // ── Master data ──────────────────────────────────────────────
  brands: 'master_brand',
  outlets: 'master_outlet',
  items: 'master_item',
  suppliers: 'master_supplier',
  locations: 'master_location',
  unitConversion: 'master_unit_conversion',
  itemCategory: 'master_item_category',
  inventoryThreshold: 'master_inventory_threshold',
  // ── Stock movement ledger (auto immutable) ───────────────────
  stockMovement: 'warehouse_stock_movement',
  // ── Transactions: header + detail ────────────────────────────
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
  // ── Batch / expiry ───────────────────────────────────────────
  batchStock: 'warehouse_batch_stock',
  // ── Purchase engine ──────────────────────────────────────────
  purchaseRecommendation: 'warehouse_purchase_recommendation',
  purchaseRequest: 'warehouse_purchase_request',
  purchaseRequestItem: 'warehouse_purchase_request_item',
  // ── Alerts + actions ─────────────────────────────────────────
  alertLog: 'warehouse_alert_log',
  actionTracker: 'warehouse_action_tracker',
  // ── Output ───────────────────────────────────────────────────
  dailySummary: 'warehouse_daily_summary',
  telegramDeliveryLog: 'telegram_delivery_log',
  // ── Auth + audit ─────────────────────────────────────────────
  users: 'users',
  auditLog: 'system_audit_log',
  // ── Legacy F1-F5 (read migration only) ───────────────────────
  legacyPenerimaan: 'f1_penerimaan',
  legacyKartuStok: 'f2_kartu_stok',
  legacyPemakaian: 'f3_bon_pemakaian',
  legacyWaste: 'f4_waste',
  legacyClosing: 'f5_closing',
  legacyDashboard: 'dashboard',
  legacyAlerts: 'hermes_alert_log'
} as const;

export type TabName = (typeof TABS)[keyof typeof TABS];

/** Header row for each tab. Order = column index. */
export const TAB_HEADERS: Record<TabName, string[]> = {
  // ── Master ───────────────────────────────────────────────────
  [TABS.brands]: ['brand_id', 'brand_name', 'brand_code', 'status', 'created_at', 'updated_at'],
  [TABS.outlets]: [
    'outlet_id', 'brand_id', 'outlet_name', 'outlet_code', 'address',
    'status', 'created_at', 'updated_at'
  ],
  // §8.1 master_item — 32 columns
  [TABS.items]: [
    'item_id', 'item_code', 'item_name', 'brand_id', 'category_id',
    'item_type', 'base_unit', 'purchase_unit', 'conversion_factor', 'pack_size',
    'minimum_order_quantity', 'preferred_supplier_id', 'backup_supplier_id',
    'latest_purchase_price', 'average_purchase_price',
    'minimum_stock', 'safety_stock', 'maximum_stock', 'reorder_point',
    'average_daily_usage', 'supplier_lead_time_days',
    'supplier_order_day', 'supplier_delivery_day', 'expiry_days',
    'criticality', 'tolerance_variance_percentage', 'tolerance_variance_value',
    'recipe_linked_status', 'active_status',
    'created_at', 'updated_at', 'created_by', 'updated_by'
  ],
  // §8.3 master_supplier — expanded
  [TABS.suppliers]: [
    'supplier_id', 'supplier_code', 'supplier_name', 'item_category',
    'phone', 'email', 'address', 'bank_name', 'bank_account', 'account_holder',
    'lead_time_days', 'minimum_order_value', 'preferred_delivery_day',
    'active_status', 'created_at', 'updated_at'
  ],
  // §8.2 master_location
  [TABS.locations]: [
    'location_id', 'location_code', 'location_name', 'brand_id', 'outlet_id',
    'location_type', 'parent_location_id', 'address', 'active_status',
    'created_at', 'updated_at'
  ],
  // §8.4 master_unit_conversion
  [TABS.unitConversion]: [
    'conversion_id', 'item_id', 'from_unit', 'to_unit', 'conversion_factor',
    'active_status', 'created_at'
  ],
  // §8.5 master_item_category
  [TABS.itemCategory]: [
    'category_id', 'category_name', 'parent_category_id', 'active_status',
    'created_at'
  ],
  // §8.6 master_inventory_threshold
  [TABS.inventoryThreshold]: [
    'threshold_id', 'brand_id', 'outlet_id', 'location_id', 'item_id',
    'threshold_type', 'warning_value', 'high_value', 'critical_value',
    'unit', 'active_status', 'updated_by', 'updated_at'
  ],
  // ── Stock movement ledger §15 ────────────────────────────────
  [TABS.stockMovement]: [
    'movement_id', 'movement_number', 'movement_datetime', 'item_id', 'brand_id',
    'outlet_id', 'location_id', 'movement_type', 'direction', 'quantity',
    'base_unit', 'unit_cost', 'total_value', 'reference_type', 'reference_id',
    'source_location_id', 'destination_location_id', 'stock_before', 'stock_after',
    'created_by', 'approved_by', 'notes', 'environment', 'created_at'
  ],
  // ── Receiving §12 ────────────────────────────────────────────
  [TABS.receiving]: [
    'receiving_id', 'receiving_number', 'date', 'receiving_time', 'source_type',
    'supplier_id', 'source_location_id', 'destination_location_id',
    'purchase_order_id', 'invoice_number', 'delivery_note_number',
    'received_by', 'verified_by', 'receiving_status', 'photo_url', 'notes',
    'created_at', 'approved_at'
  ],
  [TABS.receivingItem]: [
    'receiving_item_id', 'receiving_id', 'item_id', 'batch_number', 'expiry_date',
    'qty_ordered', 'qty_delivered', 'qty_accepted', 'qty_rejected', 'unit',
    'unit_price', 'total_value', 'rejection_reason', 'condition_status',
    'temperature_value', 'photo_url', 'notes'
  ],
  // ── Stock issue §13 ──────────────────────────────────────────
  [TABS.stockIssue]: [
    'issue_id', 'issue_number', 'date', 'shift_id', 'brand_id', 'outlet_id',
    'source_location_id', 'destination_location_id', 'issue_type',
    'requested_by', 'issued_by', 'received_by', 'approval_status', 'notes',
    'created_at', 'approved_at'
  ],
  [TABS.stockIssueItem]: [
    'issue_item_id', 'issue_id', 'item_id', 'requested_qty', 'issued_qty',
    'unit', 'batch_reference', 'purpose', 'notes'
  ],
  // ── Waste §16.1 ──────────────────────────────────────────────
  [TABS.waste]: [
    'waste_id', 'waste_number', 'date', 'time', 'brand_id', 'outlet_id',
    'location_id', 'shift_id', 'item_id', 'menu_id', 'batch_reference',
    'qty', 'unit', 'estimated_unit_cost', 'estimated_total_value', 'waste_type',
    'reason', 'root_cause', 'photo_url', 'reported_by', 'witness_by',
    'approval_status', 'approved_by', 'related_order_id', 'related_incident_id',
    'preventive_action', 'created_at'
  ],
  // ── Adjustment §16.2 ─────────────────────────────────────────
  [TABS.adjustment]: [
    'adjustment_id', 'date', 'item_id', 'location_id', 'adjustment_type',
    'qty_difference', 'unit', 'reason', 'reference_count_id',
    'requested_by', 'approved_by', 'approval_status', 'created_at'
  ],
  // ── Transfer §14 ─────────────────────────────────────────────
  [TABS.transfer]: [
    'transfer_id', 'transfer_number', 'date', 'source_location_id',
    'destination_location_id', 'requested_by', 'approved_by', 'dispatched_by',
    'received_by', 'dispatch_time', 'received_time', 'status', 'notes',
    'created_at', 'updated_at'
  ],
  [TABS.transferItem]: [
    'transfer_item_id', 'transfer_id', 'item_id', 'requested_qty',
    'dispatched_qty', 'received_qty', 'unit', 'discrepancy_qty',
    'discrepancy_reason', 'photo_url'
  ],
  // ── Stock opname §17 ─────────────────────────────────────────
  [TABS.stockCount]: [
    'count_id', 'count_number', 'count_date', 'count_type', 'brand_id',
    'outlet_id', 'location_id', 'status', 'counted_by', 'verified_by',
    'approved_by', 'created_at', 'completed_at'
  ],
  [TABS.stockCountItem]: [
    'count_item_id', 'count_id', 'item_id', 'book_stock', 'theoretical_stock',
    'physical_stock', 'base_unit', 'variance_vs_book_qty',
    'variance_vs_book_percentage', 'variance_vs_book_value',
    'variance_vs_theoretical_qty', 'tolerance_percentage', 'tolerance_value',
    'severity', 'recount_required', 'recount_result', 'root_cause',
    'investigation_status', 'assigned_to', 'due_date', 'approval_status', 'notes'
  ],
  // ── Batch stock §18 ──────────────────────────────────────────
  [TABS.batchStock]: [
    'batch_stock_id', 'item_id', 'location_id', 'batch_number', 'expiry_date',
    'received_date', 'current_qty', 'unit', 'unit_cost', 'status',
    'created_at', 'updated_at'
  ],
  // ── Purchase recommendation §10 ──────────────────────────────
  [TABS.purchaseRecommendation]: [
    'recommendation_id', 'date', 'item_id', 'item_name', 'brand_id', 'outlet_id',
    'location_id', 'available_stock', 'average_daily_usage', 'days_of_cover',
    'reorder_point', 'maximum_stock', 'incoming_po_qty', 'reserved_qty',
    'suggested_purchase_qty', 'rounded_purchase_qty', 'purchase_unit',
    'supplier_id', 'supplier_name', 'estimated_unit_price',
    'estimated_purchase_value', 'required_by_date', 'priority', 'reason',
    'recommendation_status', 'created_at', 'approved_by', 'approved_at'
  ],
  // ── Purchase request §11 ─────────────────────────────────────
  [TABS.purchaseRequest]: [
    'purchase_request_id', 'request_number', 'date', 'brand_id', 'outlet_id',
    'location_id', 'requested_by', 'required_by_date', 'priority',
    'estimated_total_value', 'status', 'approved_by', 'approved_at',
    'purchasing_pic', 'notes', 'created_at', 'updated_at'
  ],
  [TABS.purchaseRequestItem]: [
    'request_item_id', 'purchase_request_id', 'item_id', 'requested_qty',
    'purchase_unit', 'estimated_unit_price', 'estimated_total',
    'preferred_supplier_id', 'reason', 'source_recommendation_id'
  ],
  // ── Alert log §19 ────────────────────────────────────────────
  [TABS.alertLog]: [
    'alert_id', 'alert_datetime', 'alert_type', 'severity', 'brand_id',
    'outlet_id', 'location_id', 'item_id', 'reference_type', 'reference_id',
    'title', 'message', 'status', 'assigned_to', 'due_date',
    'action_required', 'telegram_status', 'created_at', 'resolved_at', 'resolved_by'
  ],
  // ── Action tracker §20 ───────────────────────────────────────
  [TABS.actionTracker]: [
    'action_id', 'source_alert_id', 'title', 'description', 'brand_id',
    'outlet_id', 'location_id', 'item_id', 'priority', 'assigned_to',
    'assigned_role', 'due_date', 'status', 'action_taken', 'attachment_url',
    'approved_by', 'created_at', 'updated_at', 'completed_at'
  ],
  // ── Daily summary §21 ────────────────────────────────────────
  [TABS.dailySummary]: [
    'summary_id', 'date', 'brand_id', 'brand_name', 'outlet_id', 'outlet_name',
    'location_id', 'total_inventory_value', 'critical_low_stock_count',
    'stockout_risk_count', 'purchase_recommendation_count',
    'estimated_purchase_value', 'pending_purchase_request_count',
    'pending_receiving_count', 'receiving_discrepancy_count',
    'pending_transfer_count', 'transfer_discrepancy_count',
    'waste_item_count', 'waste_value', 'variance_item_count',
    'unexplained_variance_value', 'near_expiry_item_count',
    'expired_item_count', 'open_action_count', 'overdue_action_count',
    'major_warehouse_issue', 'recommended_action', 'generated_at'
  ],
  // ── Telegram delivery log §23.6 ──────────────────────────────
  [TABS.telegramDeliveryLog]: [
    'delivery_id', 'source_module', 'source_reference_id', 'message_type',
    'recipient', 'message_id', 'status', 'retry_count', 'sent_at',
    'error_message', 'created_at'
  ],
  // ── Auth + audit ─────────────────────────────────────────────
  [TABS.users]: [
    'user_id', 'username', 'password_hash', 'role', 'brand_id', 'outlet_id',
    'active_status', 'created_at', 'last_login_at'
  ],
  // §30 system_audit_log — expanded
  [TABS.auditLog]: [
    'audit_id', 'module', 'action', 'record_type', 'record_id',
    'before_value', 'after_value', 'reason', 'user_id', 'approval_user_id',
    'environment', 'ip_address', 'created_at'
  ],
  // ── Legacy (read migration only) ─────────────────────────────
  [TABS.legacyPenerimaan]: [
    'receive_id', 'date', 'time', 'outlet_id', 'pic_stock', 'shift',
    'po_number', 'supplier_id', 'item_id', 'item_name', 'qty_order',
    'qty_received', 'unit', 'difference', 'condition', 'signed_by',
    'created_at', 'created_by'
  ],
  [TABS.legacyKartuStok]: [
    'stock_tx_id', 'date', 'time', 'outlet_id', 'item_id', 'item_name',
    'tx_type', 'reference_id', 'qty_in', 'qty_out', 'saldo', 'unit',
    'keterangan', 'pic', 'created_at'
  ],
  [TABS.legacyPemakaian]: [
    'usage_id', 'date', 'time', 'outlet_id', 'item_id', 'item_name',
    'qty_out', 'unit', 'for_menu', 'requested_by', 'approved_by_pic',
    'shift', 'created_at', 'created_by'
  ],
  [TABS.legacyWaste]: [
    'waste_id', 'date', 'outlet_id', 'item_id', 'item_name',
    'qty', 'unit', 'reason', 'photo_url', 'has_photo', 'pic',
    'witness_signature', 'estimated_loss', 'created_at', 'created_by'
  ],
  [TABS.legacyClosing]: [
    'closing_id', 'date', 'outlet_id', 'pic_stock', 'shift',
    'item_id', 'item_name', 'unit', 'stock_open', 'received',
    'used', 'waste', 'expected_stock', 'actual_stock', 'difference',
    'diff_pct', 'status', 'created_at'
  ],
  [TABS.legacyDashboard]: [
    'period', 'outlet_id', 'avg_daily_diff_pct', 'food_cost_pct',
    'waste_ratio_pct', 'receiving_accuracy_pct', 'form_compliance_pct',
    'total_diff_value', 'audit_count', 'top_issue', 'created_at'
  ],
  [TABS.legacyAlerts]: [
    'alert_id', 'date', 'brand', 'outlet', 'source_app', 'alert_type',
    'severity', 'message', 'status', 'assigned_to', 'action_taken',
    'created_at', 'resolved_at'
  ]
};

/** Read a tab as array of objects keyed by header. Empty cells → "". */
export async function readTab<T = Record<string, string>>(tab: TabName): Promise<T[]> {
  if (isMockMode()) return mockReadTab(tab) as T[];
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const headers = TAB_HEADERS[tab];
  const lastCol = columnLetter(headers.length);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: `${quoteTab(tab)}!A1:${lastCol}1000`
  });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];
  const headerRow = rows[0] as string[];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headerRow.forEach((h, i) => {
      obj[h] = (row[i] as string) ?? '';
    });
    return obj as T;
  });
}

/** Append rows to a tab. Returns the 1-based starting row of the inserted block. */
export async function appendRows(tab: TabName, rows: Record<string, string>[]): Promise<number> {
  if (rows.length === 0) return -1;
  if (isMockMode()) return mockAppendRows(tab, rows);
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const headers = TAB_HEADERS[tab];
  const values = rows.map((r) => headers.map((h) => r[h] ?? ''));
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: sid,
    range: `${quoteTab(tab)}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values }
  });
  const updatedRange = res.data.updates?.updatedRange ?? '';
  const m = updatedRange.match(/![A-Z]+(\d+):/);
  return m && m[1] ? Number(m[1]) : -1;
}

/** Quote tab name only when it needs it (spaces/special chars). */
function quoteTab(tab: string): string {
  return /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${tab}'`;
}

/** Convert a 1-based column index to a spreadsheet column letter (1→A, 27→AA). */
export function columnLetter(colIdx1Based: number): string {
  if (colIdx1Based < 1) throw new Error('columnLetter requires 1-based index >= 1');
  let n = colIdx1Based;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Update a single row identified by tab + row number. */
export async function updateRow(
  tab: TabName,
  rowNumber: number,
  values: Record<string, string>
): Promise<void> {
  if (isMockMode()) { mockUpdateRow(tab, rowNumber, values); return; }
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const headers = TAB_HEADERS[tab];
  const lastCol = columnLetter(headers.length);
  const arr = headers.map((h) => values[h] ?? '');
  await sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: `${quoteTab(tab)}!A${rowNumber}:${lastCol}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [arr] }
  });
}

/** Find the 1-based sheet row of the first row whose key column matches value. Returns null if not found. */
export async function findRow(
  tab: TabName,
  keyCol: string,
  value: string
): Promise<{ rowNumber: number; row: Record<string, string> } | null> {
  if (isMockMode()) return mockFindRow(tab, keyCol, value);
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const headers = TAB_HEADERS[tab];
  const colIdx = headers.indexOf(keyCol);
  if (colIdx < 0) throw new Error(`Column ${keyCol} not in ${tab}`);
  const lastCol = columnLetter(headers.length);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: `${quoteTab(tab)}!A1:${lastCol}`
  });
  const rows = res.data.values ?? [];
  for (let i = 1; i < rows.length; i++) {
    const cell = rows[i]?.[colIdx];
    if (cell === value) {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = (rows[i]?.[idx] !== undefined ? rows[i]![idx] : '') as string;
      });
      return { rowNumber: i + 1, row: obj };
    }
  }
  return null;
}