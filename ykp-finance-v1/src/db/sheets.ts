/**
 * Google Sheets DB layer for YKP Finance Module V1.
 *
 * One spreadsheet = "YKP_FINANCE_V1". Each table = one tab. Header row is row 1,
 * data starts row 2. All writes go through append/update to keep quota low.
 *
 * Schema follows:
 *  - YKP_ERP_Finance_Developer_Brief_V1 (POS revenue, supplier costing, petty cash,
 *    expense, fin_daily_summary for Hermez)
 *  - YKP_Hermez_Migration_Blueprint (naming BR-/OL-/SUP-, integer IDR, Asia/Jakarta,
 *    fin_daily_summary contract §9.2)
 *  - YKP_ERP_List_Revisi_Developer (#3 "Estimated Cash Surplus" naming, #4 cross-links
 *    anti double-count, #5 settlement validation, #6 supplier attachments+approval,
 *    #7 petty cash per account, #10 threshold config tab)
 *
 * FK validation is done in the repository layer (lib/repo.ts).
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
  const id = process.env.YKP_FINANCE_SPREADSHEET_ID;
  if (!id) throw new Error('YKP_FINANCE_SPREADSHEET_ID is not set in .env');
  return id;
}

/** All sheet/tab names. One tab per table. */
export const TABS = {
  // ── Master data ──────────────────────────────────────────────
  brands: 'master_brand',
  outlets: 'master_outlet',
  suppliers: 'master_supplier',
  expenseCategories: 'fin_expense_category',
  paymentMethods: 'fin_payment_method',
  pettyCashAccounts: 'fin_petty_cash_account',
  // ── Transactions ─────────────────────────────────────────────
  posDaily: 'fin_pos_daily',
  posItems: 'fin_pos_items',
  supplierCost: 'fin_supplier_cost',
  pettyCash: 'fin_petty_cash',
  expense: 'fin_expense',
  closingCash: 'fin_closing_cash',
  // ── Output: daily summary for Hermez ─────────────────────────
  dailySummary: 'fin_daily_summary',
  // ── Alerts + actions ─────────────────────────────────────────
  alertLog: 'finance_alert_log',
  actionTracker: 'finance_action_tracker',
  // ── Config ───────────────────────────────────────────────────
  thresholdConfig: 'finance_threshold_config',
  // ── Auth + audit ─────────────────────────────────────────────
  users: 'users',
  auditLog: 'audit_log',
  telegramDeliveryLog: 'telegram_delivery_log'
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
  [TABS.suppliers]: [
    'supplier_id', 'supplier_name', 'category', 'phone', 'bank_name',
    'bank_account', 'account_holder', 'status', 'created_at', 'updated_at'
  ],
  // blueprint §7.2.4.1
  [TABS.expenseCategories]: [
    'category_id', 'category_name', 'account_type', 'status', 'created_at'
  ],
  // blueprint §7.2.4.2
  [TABS.paymentMethods]: [
    'method_id', 'method_name', 'type', 'is_cash', 'status', 'created_at'
  ],
  // blueprint §7.2.4.3 + Revisi #7 (per-account limit/opening)
  [TABS.pettyCashAccounts]: [
    'account_id', 'outlet_id', 'brand_id', 'account_name', 'opening_balance',
    'daily_limit', 'currency', 'status', 'created_at'
  ],
  // brief §6.2 + Revisi #5 (per-method settlement) + Revisi #4 (cross-links)
  [TABS.posDaily]: [
    'pos_id', 'date', 'brand_id', 'brand_name', 'outlet_id', 'outlet_name',
    'gross_sales', 'net_sales', 'discount', 'refund', 'void', 'tax', 'service_charge',
    'settle_cash', 'settle_qris', 'settle_card', 'settle_transfer', 'settle_marketplace',
    'total_settlement', 'settlement_difference',
    'transaction_count', 'aov', 'cashier', 'shift', 'payment_method',
    'source', 'source_ref', 'notes',
    'source_module', 'source_transaction_id', 'payment_source',
    'linked_expense_id', 'linked_supplier_invoice_id', 'linked_petty_cash_id',
    'created_by', 'created_at', 'updated_at'
  ],
  // Item-level POS sales (Moka "Item Sales" export) — one row per
  // (date, outlet, item). Owner reads these for sales-per-item reports.
  [TABS.posItems]: [
    'pos_item_id', 'date', 'brand_id', 'brand_name', 'outlet_id', 'outlet_name',
    'item_name', 'sku', 'category', 'qty', 'gross_sales', 'discount', 'refund',
    'net_sales', 'source', 'created_at'
  ],
  // brief §6.3 + Revisi #6 (invoice/approval/payment fields) + Revisi #4
  [TABS.supplierCost]: [
    'costing_id', 'date_order', 'brand_id', 'brand_name', 'outlet_id', 'outlet_name',
    'supplier_id', 'supplier_name', 'description', 'category', 'qty', 'unit', 'unit_price',
    'total_amount', 'paid_amount', 'unpaid_amount', 'payment_status', 'due_date',
    'bank_account', 'invoice_number', 'invoice_url', 'receipt_url',
    'approval_status', 'approved_by', 'payment_date', 'payment_ref', 'notes',
    'source_module', 'source_transaction_id', 'payment_source',
    'linked_expense_id', 'linked_petty_cash_id',
    'created_by', 'created_at', 'updated_at'
  ],
  // brief §6.4 + Revisi #7 (per-account opening/topup/out/physical/diff/closing)
  [TABS.pettyCash]: [
    'petty_id', 'date', 'brand_id', 'brand_name', 'outlet_id', 'outlet_name', 'account_id',
    'description', 'category', 'qty', 'unit', 'debit_topup', 'credit_out', 'running_balance',
    'physical_cash', 'cash_difference', 'closing_status', 'cash_on_hand_status',
    'receipt_url', 'urgent_flag', 'approval_status', 'approved_by', 'notes',
    'source_module', 'source_transaction_id', 'payment_source',
    'linked_expense_id', 'linked_supplier_invoice_id',
    'created_by', 'created_at'
  ],
  // brief §6.5 + Revisi #8 (approval, status) + Revisi #4
  [TABS.expense]: [
    'expense_id', 'date', 'brand_id', 'brand_name', 'outlet_id', 'outlet_name',
    'expense_category', 'description', 'amount', 'payment_method', 'receipt_url',
    'approval_status', 'approved_by', 'status', 'notes',
    'source_module', 'source_transaction_id', 'payment_source',
    'linked_supplier_invoice_id', 'linked_petty_cash_id',
    'created_by', 'created_at', 'updated_at'
  ],
  // blueprint §7.4 cash difference formula
  [TABS.closingCash]: [
    'closing_id', 'date', 'brand_id', 'outlet_id', 'outlet_name',
    'opening_cash', 'pos_cash_sales', 'cash_revenue_in', 'cash_expense_out', 'petty_cash_out',
    'expected_cash', 'physical_cash', 'cash_difference', 'notes', 'recorded_by', 'created_at'
  ],
  // blueprint §9.2 contract + brief §7 + Revisi #3 (estimated_surplus, never "net profit")
  [TABS.dailySummary]: [
    'summary_id', 'date', 'brand_id', 'brand_name', 'outlet_id', 'outlet_name',
    'gross_sales', 'net_sales', 'discount', 'refund', 'void', 'transaction_count', 'aov',
    'supplier_cost', 'petty_cash_out', 'total_expense', 'unpaid_supplier', 'cash_difference',
    'estimated_surplus', 'top_supplier', 'top_expense_category',
    'major_finance_issue', 'recommended_action', 'created_at'
  ],
  // brief §11 + Revisi #22 link to action tracker
  [TABS.alertLog]: [
    'alert_id', 'date', 'brand_id', 'brand', 'outlet_id', 'outlet', 'source_app',
    'alert_type', 'severity', 'title', 'message', 'status', 'assigned_to', 'action_taken',
    'reference_type', 'reference_id', 'created_at', 'resolved_at'
  ],
  // Revisi #22 action tracker
  [TABS.actionTracker]: [
    'action_id', 'source_alert_id', 'title', 'description', 'brand_id', 'brand',
    'outlet_id', 'outlet', 'priority', 'assigned_to', 'assigned_role', 'due_date',
    'status', 'action_taken', 'created_at', 'updated_at', 'completed_at'
  ],
  // Revisi #10 threshold config (human label, explanation, unit, scope, audit)
  [TABS.thresholdConfig]: [
    'threshold_id', 'key', 'label', 'explanation', 'value', 'unit', 'severity',
    'scope', 'brand_id', 'outlet_id', 'active', 'last_changed', 'changed_by'
  ],
  // ── Auth + audit ─────────────────────────────────────────────
  [TABS.users]: [
    'user_id', 'username', 'password_hash', 'role', 'brand_id', 'outlet_id',
    'active_status', 'created_at', 'last_login_at'
  ],
  [TABS.auditLog]: [
    'audit_id', 'module', 'action', 'record_type', 'record_id',
    'before_value', 'after_value', 'reason', 'user_id', 'approval_user_id',
    'environment', 'ip_address', 'created_at'
  ],
  [TABS.telegramDeliveryLog]: [
    'delivery_id', 'source_module', 'source_reference_id', 'message_type',
    'recipient', 'message_id', 'status', 'retry_count', 'sent_at',
    'error_message', 'created_at'
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
    range: `${quoteTab(tab)}!A1:${lastCol}`
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
