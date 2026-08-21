/**
 * Google Sheets DB for YKP Operational V1.
 * One spreadsheet = "YKP_OPS_V1". Header row 1, data from row 2.
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
    throw new Error('Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.');
  }
  const auth = new google.auth.JWT({
    email,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  });
  cached = google.sheets({ version: 'v4', auth });
  return cached;
}

export function getSpreadsheetId(): string {
  const id = process.env.YKP_OPS_SPREADSHEET_ID;
  if (!id) throw new Error('YKP_OPS_SPREADSHEET_ID is not set');
  return id;
}

export const TABS = {
  brands: 'master_brand',
  outlets: 'master_outlet',
  employees: 'master_employee',
  shifts: 'master_shift',
  products: 'master_product',
  checklistTemplates: 'master_checklist_template',
  briefing: 'ops_daily_briefing',
  opening: 'ops_opening_checklist',
  kds: 'ops_kds_order',
  qc: 'ops_qc_score',
  incidents: 'ops_incident',
  closing: 'ops_closing',
  waste: 'ops_waste',
  stockIssues: 'ops_stock_issue',
  thresholds: 'ops_threshold_config',
  summary: 'ops_daily_summary',
  users: 'ops_users',
  auditLog: 'ops_audit_log',
  hermezAlerts: 'ops_hermes_alert_log',
} as const;

export type TabName = (typeof TABS)[keyof typeof TABS];

export const TAB_HEADERS: Record<TabName, string[]> = {
  [TABS.brands]: ['brand_id', 'brand_name', 'brand_code', 'status', 'created_at'],
  [TABS.outlets]: [
    'outlet_id', 'brand_id', 'outlet_name', 'outlet_code', 'address',
    'opening_time', 'closing_time', 'status', 'created_at',
  ],
  [TABS.employees]: [
    'employee_id', 'full_name', 'role', 'department', 'brand_id', 'outlet_id', 'status', 'created_at',
  ],
  [TABS.shifts]: ['shift_id', 'shift_name', 'start_time', 'end_time', 'status'],
  [TABS.products]: [
    'product_id', 'brand_id', 'product_name', 'category', 'qc_standard_id', 'target_serving_time', 'status',
  ],
  [TABS.checklistTemplates]: [
    'checklist_template_id', 'brand_id', 'outlet_id', 'checklist_type', 'department',
    'checklist_item', 'required_photo', 'target_value', 'tolerance_value', 'critical_flag', 'active_status',
  ],
  [TABS.briefing]: [
    'briefing_id', 'date', 'brand_id', 'brand_name', 'outlet_id', 'outlet_name',
    'shift_id', 'shift_name', 'briefing_type', 'briefing_text', 'target_sales',
    'priority_menu', 'stock_warning', 'staffing_warning', 'service_focus',
    'generated_by_ai', 'manually_edited', 'approved_by', 'published_status',
    'published_at', 'created_at', 'updated_at',
  ],
  [TABS.opening]: [
    'opening_id', 'date', 'brand_id', 'outlet_id', 'shift_id', 'checklist_item',
    'status', 'photo_url', 'notes', 'completed_by', 'completed_at', 'critical_flag', 'created_at',
  ],
  [TABS.kds]: [
    'order_id', 'date', 'brand_id', 'outlet_id', 'shift_id', 'channel', 'station',
    'menu_items', 'status', 'queued_at', 'started_at', 'ready_at', 'completed_at',
    'serving_seconds', 'target_seconds', 'sla_status', 'notes', 'created_at',
  ],
  [TABS.qc]: [
    'qc_id', 'date', 'brand_id', 'outlet_id', 'shift_id', 'product_id', 'product_name',
    'batch_reference', 'qc_category', 'reference_standard_id', 'photo_url',
    'score', 'max_score', 'status', 'defect_type', 'notes', 'reviewed_by',
    'ai_result', 'ai_confidence', 'second_opinion_status', 'created_at',
  ],
  [TABS.incidents]: [
    'incident_id', 'date', 'brand_id', 'outlet_id', 'shift_id', 'incident_type',
    'severity', 'title', 'description', 'photo_url', 'customer_name', 'channel',
    'status', 'assigned_to', 'resolution_notes', 'ai_triage', 'ai_sentiment',
    'ai_response_draft', 'ai_generated_at', 'resolved_at', 'created_by', 'created_at',
  ],
  [TABS.closing]: [
    'closing_id', 'date', 'brand_id', 'outlet_id', 'shift_id', 'expected_cash',
    'actual_cash', 'cash_difference', 'checklist_status', 'issues', 'photo_url',
    'closed_by', 'approved_by', 'status', 'created_at',
  ],
  [TABS.waste]: [
    'waste_id', 'date', 'brand_id', 'outlet_id', 'shift_id', 'ingredient_id',
    'ingredient_name', 'menu_id', 'menu_name', 'qty', 'unit', 'estimated_unit_cost',
    'estimated_total_value', 'waste_type', 'reason', 'photo_url', 'reported_by',
    'approval_status', 'approved_by', 'related_incident_id', 'created_at',
  ],
  [TABS.stockIssues]: [
    'stock_issue_id', 'date', 'brand_id', 'outlet_id', 'ingredient_id', 'issue_type',
    'expected_qty', 'actual_qty', 'difference_qty', 'estimated_value', 'reason',
    'status', 'assigned_to', 'created_at', 'resolved_at',
  ],
  [TABS.thresholds]: [
    'threshold_id', 'brand_id', 'outlet_id', 'metric_name', 'warning_value',
    'high_value', 'critical_value', 'unit', 'active_status', 'updated_by', 'updated_at',
  ],
  [TABS.summary]: [
    'summary_id', 'date', 'brand_id', 'brand_name', 'outlet_id', 'outlet_name',
    'opening_status', 'opening_completion_percentage', 'critical_opening_issue',
    'scheduled_staff', 'actual_staff', 'shift_shortage', 'total_orders',
    'avg_serving_time', 'orders_over_sla', 'critical_delay_count', 'avg_qc_score',
    'qc_fail_count', 'incident_count', 'high_severity_incident', 'complaint_count',
    'waste_qty', 'waste_value', 'stock_issue_count', 'closing_status',
    'cash_difference', 'open_action_count', 'major_ops_issue', 'recommended_action',
    'ai_insight', 'ai_insight_generated_at', 'created_at',
  ],
  [TABS.users]: [
    'user_id', 'username', 'password_hash', 'role', 'brand_id', 'outlet_id',
    'active_status', 'created_at', 'last_login_at',
  ],
  [TABS.auditLog]: [
    'audit_id', 'timestamp', 'actor_user_id', 'actor_role', 'action', 'entity',
    'entity_id', 'before_value', 'after_value', 'reason', 'ip_address',
  ],
  [TABS.hermezAlerts]: [
    'alert_id', 'date', 'severity', 'alert_type', 'title', 'message',
    'outlet_id', 'status', 'created_at',
  ],
};

function quoteTab(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function columnLetter(n: number): string {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s || 'A';
}

export async function readTab<T extends Record<string, string> = Record<string, string>>(
  tab: TabName
): Promise<T[]> {
  if (isMockMode()) return mockReadTab(tab) as T[];
  const sheets = getSheetsClient();
  const headers = TAB_HEADERS[tab];
  const end = columnLetter(headers.length);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${quoteTab(tab)}!A2:${end}`,
  });
  const rows = res.data.values ?? [];
  return rows.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = r[i] != null ? String(r[i]) : '';
    });
    return obj as T;
  });
}

export async function appendRows(
  tab: TabName,
  rows: Record<string, string>[]
): Promise<{ startRow: number }> {
  if (isMockMode()) return mockAppendRows(tab, rows);
  const sheets = getSheetsClient();
  const headers = TAB_HEADERS[tab];
  const values = rows.map((row) => headers.map((h) => row[h] ?? ''));
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${quoteTab(tab)}!A:A`,
  });
  const startRow = (existing.data.values?.length ?? 1) + 1;
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `${quoteTab(tab)}!A${startRow}`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
  return { startRow };
}

export async function updateRow(
  tab: TabName,
  rowIndex: number,
  row: Record<string, string>
): Promise<void> {
  if (isMockMode()) return mockUpdateRow(tab, rowIndex, row);
  const sheets = getSheetsClient();
  const headers = TAB_HEADERS[tab];
  const values = [headers.map((h) => row[h] ?? '')];
  const end = columnLetter(headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `${quoteTab(tab)}!A${rowIndex}:${end}${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

export async function findRow(
  tab: TabName,
  keyCol: string,
  keyVal: string
): Promise<{ row: Record<string, string>; rowIndex: number } | null> {
  if (isMockMode()) return mockFindRow(tab, keyCol, keyVal);
  const rows = await readTab(tab);
  const idx = rows.findIndex((r) => r[keyCol] === keyVal);
  if (idx < 0) return null;
  return { row: rows[idx], rowIndex: idx + 2 };
}

export { quoteTab, columnLetter };
