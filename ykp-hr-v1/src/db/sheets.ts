/**
 * Google Sheets DB layer for YKP HR V1.
 *
 * One spreadsheet = "YKP_HR_V1". Each table = one tab. Header row is row 1,
 * data starts row 2. All writes go through batchUpdate to keep quota low.
 *
 * Concurrency: Sheets is last-write-wins. We use a "version" column on
 * write-once rows (employee, shift, payroll final) and rely on per-row lock
 * via append+swap for everything else. For pilot 5-10 staff this is fine.
 *
 * FK validation is done in the repository layer (apps/lib/sheets-repo.ts)
 * because Sheets has no FK constraints.
 */
import { google, type sheets_v4 } from 'googleapis';
import { isMockMode, mockReadTab, mockAppendRows, mockUpdateRow, mockFindRow } from './mock-store';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let cached: sheets_v4.Sheets | null = null;

// In-memory read cache (TTL) to avoid bursting Google Sheets read quota
// (60 reads/min/user). Any write clears the whole cache.
const READ_CACHE_TTL_MS = 10_000;
const readCache = new Map<string, { at: number; rows: Record<string, string>[] }>();
function invalidateReadCache(): void { readCache.clear(); }

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
  const id = process.env.YKP_HR_SPREADSHEET_ID;
  if (!id) throw new Error('YKP_HR_SPREADSHEET_ID is not set in .env');
  return id;
}

/** All sheet/tab names used by HR V1. One tab per table. */
export const TABS = {
  // Master data
  brands: 'master_brand',
  outlets: 'master_outlet',
  employees: 'master_employee',
  roles: 'master_role',
  shifts: 'master_shift',
  payrollRules: 'master_payroll_rule',
  latenessRules: 'master_lateness_rule',
  leaveTypes: 'master_leave_type',
  // Transactional
  attendance: 'hr_attendance',
  roster: 'hr_roster',
  lateness: 'hr_lateness',
  leaves: 'hr_leave_request',
  payroll: 'hr_payroll',
  adjustments: 'hr_adjustment',
  // Aggregate
  dailySummary: 'hr_daily_summary',
  // Auth + audit
  users: 'users',
  auditLog: 'audit_log',
  // App settings (key/value: SMTP config, dsb)
  appSettings: 'app_settings',
  // Hermez alert log (brief §11)
  hermezAlerts: 'hermes_alert_log',
  // Telegram delivery log (notification wiring)
  telegramDeliveryLog: 'telegram_delivery_log'
} as const;

export type TabName = (typeof TABS)[keyof typeof TABS];

/** Header row for each tab. Order = column index. */
export const TAB_HEADERS: Record<TabName, string[]> = {
  [TABS.brands]: ['brand_id', 'brand_name', 'brand_code', 'email', 'status', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  [TABS.outlets]: [
    'outlet_id',
    'brand_id',
    'outlet_name',
    'outlet_code',
    'address',
    'latitude',
    'longitude',
    'attendance_radius_m',
    'status',
    'created_at',
    'updated_at'
  ],
  [TABS.employees]: [
    'employee_id',
    'employee_code',
    'full_name',
    'nickname',
    'gender',
    'phone',
    'email',
    'telegram_id',
    'address',
    'date_of_birth',
    'join_date',
    'employment_status',
    'contract_type',
    'probation_end_date',
    'contract_start_date',
    'contract_end_date',
    'permanent_date',
    'department',
    'role',
    'position',
    'brand_id',
    'outlet_id',
    'supervisor_id',
    'basic_salary',
    'salary_type',
    'bank_name',
    'bank_account',
    'account_holder',
    'bpjs_status',
    'tax_status',
    'emergency_contact_name',
    'emergency_contact_phone',
    'photo_url',
    'active_status',
    'created_at',
    'updated_at',
    'created_by',
    'updated_by'
  ],
  [TABS.roles]: ['role_id', 'role_name', 'department', 'access_level', 'status', 'created_at'],
  [TABS.shifts]: [
    'shift_id',
    'shift_name',
    'brand_id',
    'outlet_id',
    'start_time',
    'end_time',
    'break_minutes',
    'late_tolerance_minutes',
    'overtime_rule_id',
    'active_status',
    'created_at'
  ],
  [TABS.payrollRules]: [
    'payroll_rule_id',
    'rule_name',
    'salary_type',
    'late_rule',
    'overtime_rule',
    'absence_rule',
    'active_status',
    'created_at'
  ],
  [TABS.latenessRules]: [
    'rule_id',
    'rule_name',
    'brand_id',
    'outlet_id',
    'tolerance_minutes',
    'calculation_method',
    'flat_amount',
    'amount_per_minute',
    'max_penalty',
    'active_status',
    'created_at'
  ],
  [TABS.leaveTypes]: [
    'leave_type_id',
    'leave_type_name',
    'paid_status',
    'document_required',
    'status',
    'created_at'
  ],
  [TABS.attendance]: [
    'attendance_id',
    'date',
    'employee_id',
    'employee_name',
    'brand_id',
    'outlet_id',
    'shift_id',
    'scheduled_check_in',
    'actual_check_in',
    'scheduled_check_out',
    'actual_check_out',
    'check_in_location',
    'check_out_location',
    'latitude',
    'longitude',
    'attendance_radius_m',
    'check_in_photo_url',
    'check_out_photo_url',
    'attendance_status',
    'late_minutes',
    'early_leave_minutes',
    'overtime_minutes',
    // Revisi item 18 — correction flow fields
    'correction_id',
    'correction_status',
    'correction_type',
    'correction_reason',
    'corrected_clock_in',
    'corrected_clock_out',
    'corrected_status',
    'correction_photo_url',
    'correction_latitude',
    'correction_longitude',
    'correction_requested_by',
    'correction_requested_at',
    'correction_approved_by',
    'correction_approved_at',
    'approved_by',
    'notes',
    'created_at',
    'updated_at'
  ],
  [TABS.roster]: [
    'roster_id',
    'date',
    'employee_id',
    'brand_id',
    'outlet_id',
    'shift_id',
    'role',
    'roster_status',
    'replacement_employee_id',
    'swap_request_id',
    'approved_by',
    'notes',
    'created_at'
  ],
  [TABS.lateness]: [
    'lateness_id',
    'date',
    'employee_id',
    'outlet_id',
    'shift_id',
    'scheduled_time',
    'actual_time',
    'late_minutes',
    'tolerance_minutes',
    'payable_late_minutes',
    'penalty_rule_id',
    'penalty_amount',
    'reason',
    'approval_status',
    'approved_by',
    'created_at'
  ],
  [TABS.leaves]: [
    'leave_id',
    'employee_id',
    'employee_name',
    'leave_type',
    'start_date',
    'end_date',
    'total_days',
    'reason',
    'attachment_url',
    'doctor_letter_url',
    'submitted_at',
    'approval_status',
    'approved_by',
    'approved_at',
    'rejection_reason',
    'notes',
    'created_at'
  ],
  [TABS.payroll]: [
    'payroll_id',
    'payroll_period',
    'employee_id',
    'employee_name',
    'brand_id',
    'outlet_id',
    'basic_salary',
    'attendance_days',
    'absent_days',
    'paid_leave_days',
    'unpaid_leave_days',
    'late_minutes',
    'attendance_deduction',
    'overtime_hours',
    'overtime_pay',
    'bonus_total',
    'penalty_total',
    'allowance_total',
    'cash_advance_deduction',
    'bpjs_deduction',
    'tax_deduction',
    'other_deduction',
    'gross_salary',
    'net_salary',
    'calculation_status',
    'approval_status',
    'payment_status',
    'locked_status',
    'locked_at',
    'locked_by',
    'unlock_reason',
    'unlock_approved_by',
    'needs_revision_reason',
    'needs_revision_at',
    'needs_revision_by',
    'payment_date',
    'payment_reference',
    'payslip_url',
    'approved_by',
    'finance_notified_at',
    'finance_notified_by',
    'email_sent_at',
    'email_sent_to',
    'email_sent_status',
    'created_at',
    'updated_at'
  ],
  [TABS.adjustments]: [
    'adjustment_id',
    'date',
    'employee_id',
    'adjustment_type',
    'category',
    'amount',
    'quantity',
    'unit',
    'reason',
    'reference_id',
    'attachment_url',
    'approval_status',
    'approved_by',
    'payroll_period',
    'created_by',
    'created_at'
  ],
  [TABS.dailySummary]: [
    'summary_id',
    'date',
    'brand_id',
    'brand_name',
    'outlet_id',
    'outlet_name',
    'total_staff',
    'scheduled_staff',
    'staff_present',
    'staff_late',
    'staff_absent',
    'staff_leave',
    'incomplete_attendance',
    'total_late_minutes',
    'overtime_hours',
    'shift_shortage',
    'payroll_issue_count',
    'major_hr_issue',
    'recommended_action',
    'created_at'
  ],
  [TABS.users]: [
    'user_id',
    'username',
    'password_hash',
    'role',
    'brand_id',
    'outlet_id',
    'department',
    'employee_id',
    'telegram_id',
    'active_status',
    'must_change_password',
    'created_at',
    'last_login_at',
    'employee_id'
  ],
  [TABS.auditLog]: [
    'audit_id',
    'timestamp',
    'actor_user_id',
    'actor_role',
    'action',
    'entity',
    'entity_id',
    'before_value',
    'after_value',
    'reason',
    'ip_address',
    'chain_hash',
    // MOM 1 Sep 2026 — align Sheets headers dengan DDL Postgres (20 kolom).
    'module',
    'record_type',
    'record_id',
    'user_id',
    'approval_user_id',
    'environment',
    'created_at'
  ],
  [TABS.appSettings]: ['setting_key', 'setting_value', 'updated_at', 'updated_by'],
  [TABS.hermezAlerts]: [
    'alert_id',
    'date',
    'brand',
    'outlet',
    'source_app',
    'alert_type',
    'severity',
    'message',
    'status',
    'assigned_to',
    'action_taken',
    'created_at',
    'resolved_at'
  ],
  [TABS.telegramDeliveryLog]: [
    'delivery_id',
    'source_module',
    'source_reference_id',
    'message_type',
    'recipient',
    'message_id',
    'status',
    'retry_count',
    'sent_at',
    'error_message',
    'created_at'
  ]
};

/** Read a tab as array of objects keyed by header. Empty cells → "". */
export async function readTab<T = Record<string, string>>(tab: TabName): Promise<T[]> {
  if (isMockMode()) return mockReadTab(tab) as T[];
  const hit = readCache.get(tab);
  if (hit && Date.now() - hit.at < READ_CACHE_TTL_MS) return hit.rows as T[];
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const headers = TAB_HEADERS[tab];
  const lastCol = columnLetter(headers.length);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: `${quoteTab(tab)}!A1:${lastCol}1000`
  });
  const rows = res.data.values ?? [];
  if (rows.length < 2) { readCache.set(tab, { at: Date.now(), rows: [] }); return []; }
  const headerRow = rows[0] as string[];
  const mapped = rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headerRow.forEach((h, i) => {
      obj[h] = (row[i] as string) ?? '';
    });
    return obj as T;
  });
  readCache.set(tab, { at: Date.now(), rows: mapped as Record<string, string>[] });
  return mapped;
}

/** Append rows to a tab. Returns the 1-based starting row of the inserted block. */
export async function appendRows(tab: TabName, rows: Record<string, string>[]): Promise<number> {
  invalidateReadCache();
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
  // updatedRange like "'tab'!A2:Z5" — extract start row
  const updatedRange = res.data.updates?.updatedRange ?? '';
  const m = updatedRange.match(/![A-Z]+(\d+):/);
  return m && m[1] ? Number(m[1]) : -1;
}

/**
 * Format a tab name for use in a Sheets A1 range.
 *
 * Sheets API requires single-quoting the tab name when it contains spaces
 * or special characters; quoting a simple alphanumeric+underscore name
 * (e.g. `users`, `hr_attendance`) produces a malformed range like `'users'!A1:I`
 * which Google rejects with `Unable to parse range`.
 *
 * Quote only when the name needs it.
 */
function quoteTab(tab: string): string {
  return /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${tab}'`;
}

/** Convert a 1-based column index to a spreadsheet column letter (1→A, 27→AA, 34→AH). */
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
  invalidateReadCache();
  if (isMockMode()) { mockUpdateRow(tab, rowNumber, values); return; }
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const headers = TAB_HEADERS[tab];
  const lastCol = columnLetter(headers.length); // supports >26 columns (AA, AH, AI)
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
  // Fetch the full tab (up to header count) so we can compare by keyCol AND return the whole row.
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
