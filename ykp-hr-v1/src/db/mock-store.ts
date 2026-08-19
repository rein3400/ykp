/**
 * In-memory mock DB for local demo / Playwright.
 * Self-contained (no import from sheets.ts) to avoid circular deps.
 * Activated when USE_MOCK_DB=true or Google Sheets env is missing.
 *
 * Schema matches sheets.ts TABS — full HR V1 brief (18 tabs).
 * Dates (attendance/roster/lateness/summary/payroll period) are computed in
 * Asia/Jakarta at seed time so "today" views always render demo data.
 */
import { createHash } from 'crypto';

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

/** WIB date "YYYY-MM-DD", offset in days from today. Local copy of lib/format
 *  logic — kept inline to stay dependency-free (same as warehouse mock). */
function wibDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/** WIB timestamp "YYYY-MM-DD HH:mm:ss". */
function wibTimestamp(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

// String keys must match TABS values in sheets.ts
const TAB = {
  brands: 'master_brand',
  outlets: 'master_outlet',
  employees: 'master_employee',
  roles: 'master_role',
  shifts: 'master_shift',
  payrollRules: 'master_payroll_rule',
  latenessRules: 'master_lateness_rule',
  leaveTypes: 'master_leave_type',
  attendance: 'hr_attendance',
  roster: 'hr_roster',
  lateness: 'hr_lateness',
  leaves: 'hr_leave_request',
  payroll: 'hr_payroll',
  adjustments: 'hr_adjustment',
  dailySummary: 'hr_daily_summary',
  users: 'users',
  auditLog: 'audit_log',
  hermezAlerts: 'hermes_alert_log',
  telegramDeliveryLog: 'telegram_delivery_log'
} as const;

function seed(): Record<string, Record<string, string>[]> {
  const ownerPw = createHash('sha256').update('owner123').digest('hex');
  const hrPw = createHash('sha256').update('hradmin123').digest('hex');
  const t = now();
  const tw = wibTimestamp();
  const today = wibDate(0);
  const yesterday = wibDate(-1);
  const tomorrow = wibDate(1);
  const period = today.slice(0, 7); // YYYY-MM current payroll period

  return {
    // ── Master: brands (5) ──────────────────────────────────────
    [TAB.brands]: [
      { brand_id: 'BR-001', brand_name: 'Funkydak', brand_code: 'FKD', status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { brand_id: 'BR-002', brand_name: 'Sekarpizza', brand_code: 'SKP', status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { brand_id: 'BR-003', brand_name: 'Suburbuns', brand_code: 'SBN', status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { brand_id: 'BR-004', brand_name: 'Laju Kopi', brand_code: 'LJK', status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { brand_id: 'BR-005', brand_name: 'Uncle Masala', brand_code: 'UMS', status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' }
    ],
    // ── Master: outlets (3) ─────────────────────────────────────
    [TAB.outlets]: [
      { outlet_id: 'OL-001', brand_id: 'BR-001', outlet_name: 'Funkydak Cipete', outlet_code: 'FKD-01', address: 'Jl. Cipete Raya No. 12, Jakarta Selatan', latitude: '-6.2741', longitude: '106.8006', attendance_radius_m: '100', status: 'active', created_at: t, updated_at: t },
      { outlet_id: 'OL-002', brand_id: 'BR-002', outlet_name: 'Sekarpizza Kemang', outlet_code: 'SKP-01', address: 'Jl. Kemang Raya No. 8, Jakarta Selatan', latitude: '-6.2607', longitude: '106.8105', attendance_radius_m: '100', status: 'active', created_at: t, updated_at: t },
      { outlet_id: 'OL-003', brand_id: 'BR-004', outlet_name: 'Laju Kopi Tebet', outlet_code: 'LJK-01', address: 'Jl. Tebet Raya No. 45, Jakarta Selatan', latitude: '-6.2383', longitude: '106.8522', attendance_radius_m: '150', status: 'active', created_at: t, updated_at: t }
    ],
    // ── Master: employees (12) ──────────────────────────────────
    [TAB.employees]: [
      { employee_id: 'EMP-001', employee_code: 'EMP-001', full_name: 'Budi Santoso', nickname: 'Budi', gender: 'M', phone: '081234560001', email: 'budi.santoso@ykp.id', telegram_id: '551234001', address: 'Jl. Cilandak Tengah No. 3', date_of_birth: '1990-04-12', join_date: '2022-01-10', employment_status: 'PERMANENT', contract_type: 'FULL_TIME', department: 'Operations', role: 'Store Manager', position: 'Store Manager', brand_id: 'BR-001', outlet_id: 'OL-001', supervisor_id: '', basic_salary: '6500000', salary_type: 'MONTHLY', bank_name: 'BCA', bank_account: '7310001001', account_holder: 'Budi Santoso', bpjs_status: 'active', tax_status: 'K/0', emergency_contact_name: 'Siti Santoso', emergency_contact_phone: '081234560101', photo_url: '', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { employee_id: 'EMP-002', employee_code: 'EMP-002', full_name: 'Sari Dewi', nickname: 'Sari', gender: 'F', phone: '081234560002', email: 'sari.dewi@ykp.id', telegram_id: '551234002', address: 'Jl. Cipete Dalam No. 7', date_of_birth: '1994-08-25', join_date: '2022-06-01', employment_status: 'PERMANENT', contract_type: 'FULL_TIME', department: 'Operations', role: 'Supervisor', position: 'Supervisor', brand_id: 'BR-001', outlet_id: 'OL-001', supervisor_id: 'EMP-001', basic_salary: '4800000', salary_type: 'MONTHLY', bank_name: 'Mandiri', bank_account: '1440002002', account_holder: 'Sari Dewi', bpjs_status: 'active', tax_status: 'TK/0', emergency_contact_name: 'Dewi Lestari', emergency_contact_phone: '081234560102', photo_url: '', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { employee_id: 'EMP-003', employee_code: 'EMP-003', full_name: 'Andi Pratama', nickname: 'Andi', gender: 'M', phone: '081234560003', email: 'andi.pratama@ykp.id', telegram_id: '551234003', address: 'Jl. Fatmawati No. 21', date_of_birth: '1998-02-14', join_date: '2023-03-15', employment_status: 'PROBATION', contract_type: 'FULL_TIME', department: 'Kitchen', role: 'Kitchen Crew', position: 'Kitchen Crew', brand_id: 'BR-001', outlet_id: 'OL-001', supervisor_id: 'EMP-002', basic_salary: '150000', salary_type: 'DAILY', bank_name: 'BCA', bank_account: '7310003003', account_holder: 'Andi Pratama', bpjs_status: 'inactive', tax_status: 'TK/0', emergency_contact_name: 'Rina Pratama', emergency_contact_phone: '081234560103', photo_url: '', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { employee_id: 'EMP-004', employee_code: 'EMP-004', full_name: 'Maya Kusuma', nickname: 'Maya', gender: 'F', phone: '081234560004', email: 'maya.kusuma@ykp.id', telegram_id: '551234004', address: 'Jl. Antasari No. 9', date_of_birth: '1996-11-30', join_date: '2022-09-01', employment_status: 'PERMANENT', contract_type: 'FULL_TIME', department: 'Front', role: 'Cashier', position: 'Cashier', brand_id: 'BR-001', outlet_id: 'OL-001', supervisor_id: 'EMP-002', basic_salary: '3500000', salary_type: 'MONTHLY', bank_name: 'BRI', bank_account: '0221004004', account_holder: 'Maya Kusuma', bpjs_status: 'active', tax_status: 'TK/0', emergency_contact_name: 'Joko Kusuma', emergency_contact_phone: '081234560104', photo_url: '', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { employee_id: 'EMP-005', employee_code: 'EMP-005', full_name: 'Rizky Ramadhan', nickname: 'Rizky', gender: 'M', phone: '081234560005', email: 'rizky.ramadhan@ykp.id', telegram_id: '551234005', address: 'Jl. Pangeran Antasari No. 40', date_of_birth: '2000-05-17', join_date: '2024-01-08', employment_status: 'CONTRACT', contract_type: 'PART_TIME', department: 'Front', role: 'Service Crew', position: 'Service Crew', brand_id: 'BR-001', outlet_id: 'OL-001', supervisor_id: 'EMP-002', basic_salary: '25000', salary_type: 'HOURLY', bank_name: 'BCA', bank_account: '7310005005', account_holder: 'Rizky Ramadhan', bpjs_status: 'inactive', tax_status: 'TK/0', emergency_contact_name: 'Nur Ramadhan', emergency_contact_phone: '081234560105', photo_url: '', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { employee_id: 'EMP-006', employee_code: 'EMP-006', full_name: 'Dian Prasetyo', nickname: 'Dian', gender: 'M', phone: '081234560006', email: 'dian.prasetyo@ykp.id', telegram_id: '551234006', address: 'Jl. Kemang Timur No. 15', date_of_birth: '1993-07-19', join_date: '2022-04-01', employment_status: 'PERMANENT', contract_type: 'FULL_TIME', department: 'Operations', role: 'Supervisor', position: 'Supervisor', brand_id: 'BR-002', outlet_id: 'OL-002', supervisor_id: '', basic_salary: '4800000', salary_type: 'MONTHLY', bank_name: 'Mandiri', bank_account: '1440006006', account_holder: 'Dian Prasetyo', bpjs_status: 'active', tax_status: 'K/0', emergency_contact_name: 'Ayu Prasetyo', emergency_contact_phone: '081234560106', photo_url: '', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { employee_id: 'EMP-007', employee_code: 'EMP-007', full_name: 'Fitri Handayani', nickname: 'Fitri', gender: 'F', phone: '081234560007', email: 'fitri.handayani@ykp.id', telegram_id: '551234007', address: 'Jl. Bangka Raya No. 22', date_of_birth: '1997-03-08', join_date: '2023-05-20', employment_status: 'PROBATION', contract_type: 'FULL_TIME', department: 'Kitchen', role: 'Kitchen Crew', position: 'Kitchen Crew', brand_id: 'BR-002', outlet_id: 'OL-002', supervisor_id: 'EMP-006', basic_salary: '3200000', salary_type: 'MONTHLY', bank_name: 'BCA', bank_account: '7310007007', account_holder: 'Fitri Handayani', bpjs_status: 'active', tax_status: 'TK/0', emergency_contact_name: 'Bambang Handayani', emergency_contact_phone: '081234560107', photo_url: '', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { employee_id: 'EMP-008', employee_code: 'EMP-008', full_name: 'Agus Wijaya', nickname: 'Agus', gender: 'M', phone: '081234560008', email: 'agus.wijaya@ykp.id', telegram_id: '', address: 'Jl. Ampera Raya No. 11', date_of_birth: '1995-12-01', join_date: '2022-11-14', employment_status: 'PERMANENT', contract_type: 'FULL_TIME', department: 'Front', role: 'Cashier', position: 'Cashier', brand_id: 'BR-002', outlet_id: 'OL-002', supervisor_id: 'EMP-006', basic_salary: '3500000', salary_type: 'MONTHLY', bank_name: 'BNI', bank_account: '0881008008', account_holder: 'Agus Wijaya', bpjs_status: 'active', tax_status: 'TK/0', emergency_contact_name: 'Ratna Wijaya', emergency_contact_phone: '081234560108', photo_url: '', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { employee_id: 'EMP-009', employee_code: 'EMP-009', full_name: 'Laras Puspita', nickname: 'Laras', gender: 'F', phone: '081234560009', email: 'laras.puspita@ykp.id', telegram_id: '551234009', address: 'Jl. Tebet Barat No. 5', date_of_birth: '1999-09-23', join_date: '2023-08-01', employment_status: 'PERMANENT', contract_type: 'FULL_TIME', department: 'Bar', role: 'Barista', position: 'Senior Barista', brand_id: 'BR-004', outlet_id: 'OL-003', supervisor_id: '', basic_salary: '3800000', salary_type: 'MONTHLY', bank_name: 'BCA', bank_account: '7310009009', account_holder: 'Laras Puspita', bpjs_status: 'active', tax_status: 'TK/0', emergency_contact_name: 'Dedi Puspita', emergency_contact_phone: '081234560109', photo_url: '', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { employee_id: 'EMP-010', employee_code: 'EMP-010', full_name: 'Fajar Nugroho', nickname: 'Fajar', gender: 'M', phone: '081234560010', email: 'fajar.nugroho@ykp.id', telegram_id: '551234010', address: 'Jl. Tebet Timur No. 18', date_of_birth: '2001-01-27', join_date: '2024-06-10', employment_status: 'PROBATION', contract_type: 'PART_TIME', department: 'Bar', role: 'Barista', position: 'Junior Barista', brand_id: 'BR-004', outlet_id: 'OL-003', supervisor_id: 'EMP-009', basic_salary: '140000', salary_type: 'DAILY', bank_name: 'Mandiri', bank_account: '1440010010', account_holder: 'Fajar Nugroho', bpjs_status: 'inactive', tax_status: 'TK/0', emergency_contact_name: 'Sri Nugroho', emergency_contact_phone: '081234560110', photo_url: '', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { employee_id: 'EMP-011', employee_code: 'EMP-011', full_name: 'Intan Permata', nickname: 'Intan', gender: 'F', phone: '081234560011', email: 'intan.permata@ykp.id', telegram_id: '', address: 'Jl. MT Haryono No. 30', date_of_birth: '1998-06-05', join_date: '2023-02-01', employment_status: 'PERMANENT', contract_type: 'FULL_TIME', department: 'Front', role: 'Cashier', position: 'Cashier', brand_id: 'BR-004', outlet_id: 'OL-003', supervisor_id: 'EMP-009', basic_salary: '3400000', salary_type: 'MONTHLY', bank_name: 'BRI', bank_account: '0221011011', account_holder: 'Intan Permata', bpjs_status: 'active', tax_status: 'TK/0', emergency_contact_name: 'Hendra Permata', emergency_contact_phone: '081234560111', photo_url: '', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' },
      { employee_id: 'EMP-012', employee_code: 'EMP-012', full_name: 'Rina Marlina', nickname: 'Rina', gender: 'F', phone: '081234560012', email: 'rina.marlina@ykp.id', telegram_id: '551234012', address: 'Jl. Kuningan Barat No. 2', date_of_birth: '1992-10-11', join_date: '2021-07-01', employment_status: 'PERMANENT', contract_type: 'FULL_TIME', department: 'HR', role: 'HR Staff', position: 'HR Admin', brand_id: 'BR-001', outlet_id: 'OL-001', supervisor_id: '', basic_salary: '5500000', salary_type: 'MONTHLY', bank_name: 'BCA', bank_account: '7310012012', account_holder: 'Rina Marlina', bpjs_status: 'active', tax_status: 'K/0', emergency_contact_name: 'Yusuf Marlina', emergency_contact_phone: '081234560112', photo_url: '', active_status: 'active', created_at: t, updated_at: t, created_by: 'USR-001', updated_by: 'USR-001' }
    ],
    // ── Master: roles ───────────────────────────────────────────
    [TAB.roles]: [
      { role_id: 'ROL-001', role_name: 'Store Manager', department: 'Operations', access_level: 'outlet_manager', status: 'active', created_at: t },
      { role_id: 'ROL-002', role_name: 'Supervisor', department: 'Operations', access_level: 'supervisor', status: 'active', created_at: t },
      { role_id: 'ROL-003', role_name: 'Kitchen Crew', department: 'Kitchen', access_level: 'employee', status: 'active', created_at: t },
      { role_id: 'ROL-004', role_name: 'Cashier', department: 'Front', access_level: 'employee', status: 'active', created_at: t },
      { role_id: 'ROL-005', role_name: 'Barista', department: 'Bar', access_level: 'employee', status: 'active', created_at: t },
      { role_id: 'ROL-006', role_name: 'HR Staff', department: 'HR', access_level: 'hr_admin', status: 'active', created_at: t }
    ],
    // ── Master: shifts (3) ──────────────────────────────────────
    [TAB.shifts]: [
      { shift_id: 'SH-001', shift_name: 'Shift Pagi', brand_id: 'BR-001', outlet_id: 'OL-001', start_time: '07:00', end_time: '15:00', break_minutes: '60', late_tolerance_minutes: '10', overtime_rule_id: '', active_status: 'active', created_at: t },
      { shift_id: 'SH-002', shift_name: 'Shift Siang', brand_id: 'BR-001', outlet_id: 'OL-001', start_time: '11:00', end_time: '19:00', break_minutes: '60', late_tolerance_minutes: '10', overtime_rule_id: '', active_status: 'active', created_at: t },
      { shift_id: 'SH-003', shift_name: 'Shift Malam', brand_id: 'BR-002', outlet_id: 'OL-002', start_time: '15:00', end_time: '23:00', break_minutes: '45', late_tolerance_minutes: '5', overtime_rule_id: '', active_status: 'active', created_at: t }
    ],
    // ── Master: payroll rules ───────────────────────────────────
    [TAB.payrollRules]: [
      { payroll_rule_id: 'PRR-001', rule_name: 'Standard Monthly', salary_type: 'MONTHLY', late_rule: 'LR-001', overtime_rule: '1.5x hourly after shift end', absence_rule: 'basic_salary / 26 per absent day', active_status: 'active', created_at: t },
      { payroll_rule_id: 'PRR-002', rule_name: 'Standard Daily', salary_type: 'DAILY', late_rule: 'LR-001', overtime_rule: 'paid per overtime hour', absence_rule: 'no pay for absent day', active_status: 'active', created_at: t },
      { payroll_rule_id: 'PRR-003', rule_name: 'Standard Hourly', salary_type: 'HOURLY', late_rule: 'LR-002', overtime_rule: 'paid per overtime hour', absence_rule: 'no pay for absent day', active_status: 'active', created_at: t }
    ],
    // ── Master: lateness rules ──────────────────────────────────
    [TAB.latenessRules]: [
      { rule_id: 'LR-001', rule_name: 'Default Per-Minute', brand_id: 'BR-001', outlet_id: '', tolerance_minutes: '10', calculation_method: 'PER_MINUTE', flat_amount: '0', amount_per_minute: '1000', max_penalty: '50000', active_status: 'active', created_at: t },
      { rule_id: 'LR-002', rule_name: 'Flat Sekarpizza', brand_id: 'BR-002', outlet_id: 'OL-002', tolerance_minutes: '5', calculation_method: 'FLAT', flat_amount: '25000', amount_per_minute: '0', max_penalty: '25000', active_status: 'active', created_at: t }
    ],
    // ── Master: leave types ─────────────────────────────────────
    [TAB.leaveTypes]: [
      { leave_type_id: 'LT-001', leave_type_name: 'ANNUAL_LEAVE', paid_status: 'PAID', document_required: 'NO', status: 'active', created_at: t },
      { leave_type_id: 'LT-002', leave_type_name: 'SICK', paid_status: 'PAID', document_required: 'YES', status: 'active', created_at: t },
      { leave_type_id: 'LT-003', leave_type_name: 'PERMISSION', paid_status: 'PAID', document_required: 'NO', status: 'active', created_at: t },
      { leave_type_id: 'LT-004', leave_type_name: 'UNPAID_LEAVE', paid_status: 'UNPAID', document_required: 'NO', status: 'active', created_at: t }
    ],
    // ── hr_attendance: today (8) + yesterday (6) ────────────────
    [TAB.attendance]: [
      // Today — mix of PRESENT / LATE / ABSENT / LEAVE / INCOMPLETE
      { attendance_id: 'ATT-001', date: today, employee_id: 'EMP-001', employee_name: 'Budi Santoso', brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-001', scheduled_check_in: '07:00', actual_check_in: '06:55', scheduled_check_out: '15:00', actual_check_out: '15:05', check_in_location: 'Funkydak Cipete', check_out_location: 'Funkydak Cipete', latitude: '-6.2741', longitude: '106.8006', attendance_radius_m: '100', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'PRESENT', late_minutes: '0', early_leave_minutes: '0', overtime_minutes: '5', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: '', notes: '', created_at: tw, updated_at: tw },
      { attendance_id: 'ATT-002', date: today, employee_id: 'EMP-003', employee_name: 'Andi Pratama', brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-001', scheduled_check_in: '07:00', actual_check_in: '07:25', scheduled_check_out: '15:00', actual_check_out: '15:10', check_in_location: 'Funkydak Cipete', check_out_location: 'Funkydak Cipete', latitude: '-6.2741', longitude: '106.8006', attendance_radius_m: '100', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'LATE', late_minutes: '25', early_leave_minutes: '0', overtime_minutes: '10', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: '', notes: 'Macet di Sudirman', created_at: tw, updated_at: tw },
      { attendance_id: 'ATT-003', date: today, employee_id: 'EMP-004', employee_name: 'Maya Kusuma', brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-002', scheduled_check_in: '11:00', actual_check_in: '10:58', scheduled_check_out: '19:00', actual_check_out: '19:02', check_in_location: 'Funkydak Cipete', check_out_location: 'Funkydak Cipete', latitude: '-6.2741', longitude: '106.8006', attendance_radius_m: '100', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'PRESENT', late_minutes: '0', early_leave_minutes: '0', overtime_minutes: '2', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: '', notes: '', created_at: tw, updated_at: tw },
      { attendance_id: 'ATT-004', date: today, employee_id: 'EMP-002', employee_name: 'Sari Dewi', brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-002', scheduled_check_in: '11:00', actual_check_in: '10:52', scheduled_check_out: '19:00', actual_check_out: '', check_in_location: 'Funkydak Cipete', check_out_location: '', latitude: '-6.2741', longitude: '106.8006', attendance_radius_m: '100', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'INCOMPLETE', late_minutes: '0', early_leave_minutes: '0', overtime_minutes: '0', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: '', notes: 'Belum check-out', created_at: tw, updated_at: tw },
      { attendance_id: 'ATT-005', date: today, employee_id: 'EMP-006', employee_name: 'Dian Prasetyo', brand_id: 'BR-002', outlet_id: 'OL-002', shift_id: 'SH-003', scheduled_check_in: '15:00', actual_check_in: '', scheduled_check_out: '23:00', actual_check_out: '', check_in_location: '', check_out_location: '', latitude: '', longitude: '', attendance_radius_m: '', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'ABSENT', late_minutes: '0', early_leave_minutes: '0', overtime_minutes: '0', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: '', notes: 'Tidak hadir tanpa kabar', created_at: tw, updated_at: tw },
      { attendance_id: 'ATT-006', date: today, employee_id: 'EMP-007', employee_name: 'Fitri Handayani', brand_id: 'BR-002', outlet_id: 'OL-002', shift_id: 'SH-003', scheduled_check_in: '15:00', actual_check_in: '', scheduled_check_out: '23:00', actual_check_out: '', check_in_location: '', check_out_location: '', latitude: '', longitude: '', attendance_radius_m: '', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'LEAVE', late_minutes: '0', early_leave_minutes: '0', overtime_minutes: '0', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: 'USR-001', notes: 'Sakit — surat dokter terlampir', created_at: tw, updated_at: tw },
      { attendance_id: 'ATT-007', date: today, employee_id: 'EMP-009', employee_name: 'Laras Puspita', brand_id: 'BR-004', outlet_id: 'OL-003', shift_id: 'SH-001', scheduled_check_in: '07:00', actual_check_in: '06:58', scheduled_check_out: '15:00', actual_check_out: '15:00', check_in_location: 'Laju Kopi Tebet', check_out_location: 'Laju Kopi Tebet', latitude: '-6.2383', longitude: '106.8522', attendance_radius_m: '150', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'PRESENT', late_minutes: '0', early_leave_minutes: '0', overtime_minutes: '0', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: '', notes: '', created_at: tw, updated_at: tw },
      { attendance_id: 'ATT-008', date: today, employee_id: 'EMP-010', employee_name: 'Fajar Nugroho', brand_id: 'BR-004', outlet_id: 'OL-003', shift_id: 'SH-001', scheduled_check_in: '07:00', actual_check_in: '07:40', scheduled_check_out: '15:00', actual_check_out: '', check_in_location: 'Laju Kopi Tebet', check_out_location: '', latitude: '-6.2383', longitude: '106.8522', attendance_radius_m: '150', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'LATE', late_minutes: '40', early_leave_minutes: '0', overtime_minutes: '0', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: '', notes: 'Ban motor bocor', created_at: tw, updated_at: tw },
      // Yesterday — fully closed day
      { attendance_id: 'ATT-009', date: yesterday, employee_id: 'EMP-001', employee_name: 'Budi Santoso', brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-001', scheduled_check_in: '07:00', actual_check_in: '06:57', scheduled_check_out: '15:00', actual_check_out: '15:03', check_in_location: 'Funkydak Cipete', check_out_location: 'Funkydak Cipete', latitude: '-6.2741', longitude: '106.8006', attendance_radius_m: '100', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'PRESENT', late_minutes: '0', early_leave_minutes: '0', overtime_minutes: '3', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: '', notes: '', created_at: t, updated_at: t },
      { attendance_id: 'ATT-010', date: yesterday, employee_id: 'EMP-002', employee_name: 'Sari Dewi', brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-002', scheduled_check_in: '11:00', actual_check_in: '10:55', scheduled_check_out: '19:00', actual_check_out: '19:01', check_in_location: 'Funkydak Cipete', check_out_location: 'Funkydak Cipete', latitude: '-6.2741', longitude: '106.8006', attendance_radius_m: '100', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'PRESENT', late_minutes: '0', early_leave_minutes: '0', overtime_minutes: '1', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: '', notes: '', created_at: t, updated_at: t },
      { attendance_id: 'ATT-011', date: yesterday, employee_id: 'EMP-003', employee_name: 'Andi Pratama', brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-001', scheduled_check_in: '07:00', actual_check_in: '07:02', scheduled_check_out: '15:00', actual_check_out: '15:00', check_in_location: 'Funkydak Cipete', check_out_location: 'Funkydak Cipete', latitude: '-6.2741', longitude: '106.8006', attendance_radius_m: '100', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'PRESENT', late_minutes: '2', early_leave_minutes: '0', overtime_minutes: '0', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: '', notes: '', created_at: t, updated_at: t },
      { attendance_id: 'ATT-012', date: yesterday, employee_id: 'EMP-004', employee_name: 'Maya Kusuma', brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-002', scheduled_check_in: '11:00', actual_check_in: '11:01', scheduled_check_out: '19:00', actual_check_out: '19:00', check_in_location: 'Funkydak Cipete', check_out_location: 'Funkydak Cipete', latitude: '-6.2741', longitude: '106.8006', attendance_radius_m: '100', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'PRESENT', late_minutes: '1', early_leave_minutes: '0', overtime_minutes: '0', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: '', notes: '', created_at: t, updated_at: t },
      { attendance_id: 'ATT-013', date: yesterday, employee_id: 'EMP-008', employee_name: 'Agus Wijaya', brand_id: 'BR-002', outlet_id: 'OL-002', shift_id: 'SH-003', scheduled_check_in: '15:00', actual_check_in: '15:12', scheduled_check_out: '23:00', actual_check_out: '23:05', check_in_location: 'Sekarpizza Kemang', check_out_location: 'Sekarpizza Kemang', latitude: '-6.2607', longitude: '106.8105', attendance_radius_m: '100', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'LATE', late_minutes: '12', early_leave_minutes: '0', overtime_minutes: '5', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: '', notes: '', created_at: t, updated_at: t },
      { attendance_id: 'ATT-014', date: yesterday, employee_id: 'EMP-009', employee_name: 'Laras Puspita', brand_id: 'BR-004', outlet_id: 'OL-003', shift_id: 'SH-001', scheduled_check_in: '07:00', actual_check_in: '06:59', scheduled_check_out: '15:00', actual_check_out: '15:01', check_in_location: 'Laju Kopi Tebet', check_out_location: 'Laju Kopi Tebet', latitude: '-6.2383', longitude: '106.8522', attendance_radius_m: '150', check_in_photo_url: '', check_out_photo_url: '', attendance_status: 'PRESENT', late_minutes: '0', early_leave_minutes: '0', overtime_minutes: '1', correction_id: '', correction_status: '', correction_type: '', correction_reason: '', corrected_clock_in: '', corrected_clock_out: '', corrected_status: '', correction_photo_url: '', correction_latitude: '', correction_longitude: '', correction_requested_by: '', correction_requested_at: '', correction_approved_by: '', correction_approved_at: '', approved_by: '', notes: '', created_at: t, updated_at: t }
    ],
    // ── hr_roster: today (EMP-006 rostered but ABSENT → shift shortage) ──
    [TAB.roster]: [
      { roster_id: 'ROS-001', date: today, employee_id: 'EMP-001', brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-001', role: 'Store Manager', roster_status: 'SCHEDULED', replacement_employee_id: '', swap_request_id: '', approved_by: 'USR-002', notes: '', created_at: t },
      { roster_id: 'ROS-002', date: today, employee_id: 'EMP-002', brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-002', role: 'Supervisor', roster_status: 'SCHEDULED', replacement_employee_id: '', swap_request_id: '', approved_by: 'USR-002', notes: '', created_at: t },
      { roster_id: 'ROS-003', date: today, employee_id: 'EMP-003', brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-001', role: 'Kitchen Crew', roster_status: 'SCHEDULED', replacement_employee_id: '', swap_request_id: '', approved_by: 'USR-002', notes: '', created_at: t },
      { roster_id: 'ROS-004', date: today, employee_id: 'EMP-004', brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-002', role: 'Cashier', roster_status: 'SCHEDULED', replacement_employee_id: '', swap_request_id: '', approved_by: 'USR-002', notes: '', created_at: t },
      { roster_id: 'ROS-005', date: today, employee_id: 'EMP-005', brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-002', role: 'Service Crew', roster_status: 'OFF', replacement_employee_id: '', swap_request_id: '', approved_by: 'USR-002', notes: 'Libur mingguan', created_at: t },
      { roster_id: 'ROS-006', date: today, employee_id: 'EMP-006', brand_id: 'BR-002', outlet_id: 'OL-002', shift_id: 'SH-003', role: 'Supervisor', roster_status: 'SCHEDULED', replacement_employee_id: '', swap_request_id: '', approved_by: 'USR-002', notes: 'Rostered tapi absen — shift shortage', created_at: t },
      { roster_id: 'ROS-007', date: today, employee_id: 'EMP-008', brand_id: 'BR-002', outlet_id: 'OL-002', shift_id: 'SH-003', role: 'Cashier', roster_status: 'SCHEDULED', replacement_employee_id: '', swap_request_id: '', approved_by: 'USR-002', notes: '', created_at: t },
      { roster_id: 'ROS-008', date: today, employee_id: 'EMP-009', brand_id: 'BR-004', outlet_id: 'OL-003', shift_id: 'SH-001', role: 'Barista', roster_status: 'SCHEDULED', replacement_employee_id: '', swap_request_id: '', approved_by: 'USR-002', notes: '', created_at: t }
    ],
    // ── hr_lateness: 2 PENDING (approval UI) + 1 APPROVED ───────
    [TAB.lateness]: [
      { lateness_id: 'LAT-001', date: today, employee_id: 'EMP-003', outlet_id: 'OL-001', shift_id: 'SH-001', scheduled_time: '07:00', actual_time: '07:25', late_minutes: '25', tolerance_minutes: '10', payable_late_minutes: '15', penalty_rule_id: 'LR-001', penalty_amount: '15000', reason: 'Macet di Sudirman', approval_status: 'PENDING', approved_by: '', created_at: tw },
      { lateness_id: 'LAT-002', date: today, employee_id: 'EMP-010', outlet_id: 'OL-003', shift_id: 'SH-001', scheduled_time: '07:00', actual_time: '07:40', late_minutes: '40', tolerance_minutes: '10', payable_late_minutes: '30', penalty_rule_id: 'LR-001', penalty_amount: '30000', reason: 'Ban motor bocor', approval_status: 'PENDING', approved_by: '', created_at: tw },
      { lateness_id: 'LAT-003', date: yesterday, employee_id: 'EMP-008', outlet_id: 'OL-002', shift_id: 'SH-003', scheduled_time: '15:00', actual_time: '15:12', late_minutes: '12', tolerance_minutes: '5', payable_late_minutes: '7', penalty_rule_id: 'LR-002', penalty_amount: '25000', reason: 'Jemput anak sekolah', approval_status: 'APPROVED', approved_by: 'USR-001', created_at: t }
    ],
    // ── hr_leave_request: 1 PENDING + 1 APPROVED (covers today) ──
    [TAB.leaves]: [
      { leave_id: 'LVR-001', employee_id: 'EMP-005', employee_name: 'Rizky Ramadhan', leave_type: 'ANNUAL_LEAVE', start_date: tomorrow, end_date: wibDate(2), total_days: '2', reason: 'Acara keluarga di Bandung', attachment_url: '', doctor_letter_url: '', submitted_at: tw, approval_status: 'PENDING', approved_by: '', approved_at: '', rejection_reason: '', notes: '', created_at: tw },
      { leave_id: 'LVR-002', employee_id: 'EMP-007', employee_name: 'Fitri Handayani', leave_type: 'SICK', start_date: today, end_date: today, total_days: '1', reason: 'Demam dan flu', attachment_url: '', doctor_letter_url: 'https://example.com/doctor-letter-lvr-002.pdf', submitted_at: t, approval_status: 'APPROVED', approved_by: 'USR-001', approved_at: t, rejection_reason: '', notes: '', created_at: t }
    ],
    // ── hr_payroll: current period DRAFT / CALCULATED ───────────
    [TAB.payroll]: [
      { payroll_id: `PR-EMP-001-${period}`, payroll_period: period, employee_id: 'EMP-001', employee_name: 'Budi Santoso', brand_id: 'BR-001', outlet_id: 'OL-001', basic_salary: '6500000', attendance_days: '26', absent_days: '0', paid_leave_days: '0', unpaid_leave_days: '0', late_minutes: '0', attendance_deduction: '0', overtime_hours: '1', overtime_pay: '56250', bonus_total: '250000', penalty_total: '0', allowance_total: '500000', cash_advance_deduction: '0', bpjs_deduction: '130000', tax_deduction: '162500', other_deduction: '0', gross_salary: '7306250', net_salary: '7013750', calculation_status: 'CALCULATED', approval_status: 'PENDING', payment_status: 'UNPAID', locked_status: 'UNLOCKED', locked_at: '', locked_by: '', unlock_reason: '', unlock_approved_by: '', payment_date: '', payment_reference: '', payslip_url: '', approved_by: '', created_at: t, updated_at: tw },
      { payroll_id: `PR-EMP-002-${period}`, payroll_period: period, employee_id: 'EMP-002', employee_name: 'Sari Dewi', brand_id: 'BR-001', outlet_id: 'OL-001', basic_salary: '4800000', attendance_days: '25', absent_days: '1', paid_leave_days: '0', unpaid_leave_days: '0', late_minutes: '0', attendance_deduction: '184615', overtime_hours: '0', overtime_pay: '0', bonus_total: '0', penalty_total: '0', allowance_total: '300000', cash_advance_deduction: '0', bpjs_deduction: '96000', tax_deduction: '120000', other_deduction: '0', gross_salary: '4915385', net_salary: '4699385', calculation_status: 'DRAFT', approval_status: 'PENDING', payment_status: 'UNPAID', locked_status: 'UNLOCKED', locked_at: '', locked_by: '', unlock_reason: '', unlock_approved_by: '', payment_date: '', payment_reference: '', payslip_url: '', approved_by: '', created_at: t, updated_at: tw },
      { payroll_id: `PR-EMP-004-${period}`, payroll_period: period, employee_id: 'EMP-004', employee_name: 'Maya Kusuma', brand_id: 'BR-001', outlet_id: 'OL-001', basic_salary: '3500000', attendance_days: '26', absent_days: '0', paid_leave_days: '0', unpaid_leave_days: '0', late_minutes: '1', attendance_deduction: '1000', overtime_hours: '0', overtime_pay: '0', bonus_total: '0', penalty_total: '1000', allowance_total: '300000', cash_advance_deduction: '200000', bpjs_deduction: '70000', tax_deduction: '87500', other_deduction: '0', gross_salary: '3799000', net_salary: '3441500', calculation_status: 'DRAFT', approval_status: 'PENDING', payment_status: 'UNPAID', locked_status: 'UNLOCKED', locked_at: '', locked_by: '', unlock_reason: '', unlock_approved_by: '', payment_date: '', payment_reference: '', payslip_url: '', approved_by: '', created_at: t, updated_at: tw }
    ],
    // ── hr_adjustment ───────────────────────────────────────────
    [TAB.adjustments]: [
      { adjustment_id: 'ADJ-001', date: yesterday, employee_id: 'EMP-001', adjustment_type: 'BONUS', category: 'PERFORMANCE', amount: '250000', quantity: '1', unit: 'IDR', reason: 'Target penjualan bulan lalu tercapai 110%', reference_id: '', attachment_url: '', approval_status: 'APPROVED', approved_by: 'USR-001', payroll_period: period, created_by: 'USR-002', created_at: t },
      { adjustment_id: 'ADJ-002', date: today, employee_id: 'EMP-003', adjustment_type: 'PENALTY', category: 'LATENESS', amount: '15000', quantity: '15', unit: 'minutes', reason: 'Keterlambatan melebihi toleransi', reference_id: 'LAT-001', attachment_url: '', approval_status: 'PENDING', approved_by: '', payroll_period: period, created_by: 'USR-002', created_at: tw }
    ],
    // ── hr_daily_summary: today (2 outlets) + yesterday ─────────
    [TAB.dailySummary]: [
      { summary_id: 'SUM-001', date: today, brand_id: 'BR-001', brand_name: 'Funkydak', outlet_id: 'OL-001', outlet_name: 'Funkydak Cipete', total_staff: '6', scheduled_staff: '5', staff_present: '3', staff_late: '1', staff_absent: '0', staff_leave: '0', incomplete_attendance: '1', total_late_minutes: '25', overtime_hours: '0.3', shift_shortage: '0', payroll_issue_count: '0', major_hr_issue: '1 incomplete attendance', recommended_action: 'Minta Sari Dewi check-out / koreksi manual', created_at: tw },
      { summary_id: 'SUM-002', date: today, brand_id: 'BR-002', brand_name: 'Sekarpizza', outlet_id: 'OL-002', outlet_name: 'Sekarpizza Kemang', total_staff: '3', scheduled_staff: '2', staff_present: '0', staff_late: '0', staff_absent: '1', staff_leave: '1', incomplete_attendance: '0', total_late_minutes: '0', overtime_hours: '0', shift_shortage: '1', payroll_issue_count: '0', major_hr_issue: 'Shift shortage 1', recommended_action: 'Cari pengganti Dian Prasetyo untuk Shift Malam', created_at: tw },
      { summary_id: 'SUM-003', date: yesterday, brand_id: 'BR-001', brand_name: 'Funkydak', outlet_id: 'OL-001', outlet_name: 'Funkydak Cipete', total_staff: '6', scheduled_staff: '5', staff_present: '4', staff_late: '1', staff_absent: '0', staff_leave: '0', incomplete_attendance: '0', total_late_minutes: '3', overtime_hours: '0.1', shift_shortage: '0', payroll_issue_count: '0', major_hr_issue: '', recommended_action: '', created_at: t }
    ],
    // ── users: owner (legacy sha256 → bcrypt migration) + hr_admin ──
    [TAB.users]: [
      { user_id: 'USR-001', username: 'owner', password_hash: ownerPw, role: 'owner', brand_id: '', outlet_id: '', department: '', employee_id: '', telegram_id: '', active_status: 'active', created_at: t, last_login_at: '' },
      { user_id: 'USR-002', username: 'hradmin', password_hash: hrPw, role: 'hr_admin', brand_id: '', outlet_id: '', department: '', employee_id: '', telegram_id: '', active_status: 'active', created_at: t, last_login_at: '' }
    ],
    // ── audit_log: empty (filled at runtime) ────────────────────
    [TAB.auditLog]: [],
    // ── hermes_alert_log: OPEN alerts incl. one HIGH ────────────
    [TAB.hermezAlerts]: [
      { alert_id: 'ALR-001', date: today, brand: 'Sekarpizza', outlet: 'Sekarpizza Kemang', source_app: 'HR', alert_type: 'SHIFT_SHORTAGE', severity: 'HIGH', message: 'Shift shortage 1: Dian Prasetyo rostered Shift Malam tapi ABSENT', status: 'OPEN', assigned_to: 'USR-002', action_taken: '', created_at: tw, resolved_at: '' },
      { alert_id: 'ALR-002', date: today, brand: 'Funkydak', outlet: 'Funkydak Cipete', source_app: 'HR', alert_type: 'INCOMPLETE_ATTENDANCE', severity: 'MEDIUM', message: 'Sari Dewi belum check-out (Shift Siang)', status: 'OPEN', assigned_to: 'USR-002', action_taken: '', created_at: tw, resolved_at: '' },
      { alert_id: 'ALR-003', date: yesterday, brand: 'Sekarpizza', outlet: 'Sekarpizza Kemang', source_app: 'HR', alert_type: 'LATE_SPIKE', severity: 'LOW', message: 'Agus Wijaya terlambat 12 menit', status: 'RESOLVED', assigned_to: 'USR-002', action_taken: 'Penalty approved', created_at: t, resolved_at: t }
    ],
    // ── telegram_delivery_log ───────────────────────────────────
    [TAB.telegramDeliveryLog]: [
      { delivery_id: 'DLV-001', source_module: 'HR', source_reference_id: 'ALR-001', message_type: 'ALERT', recipient: '551234001', message_id: 'tg-1001', status: 'SENT', retry_count: '0', sent_at: tw, error_message: '', created_at: tw }
    ]
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
  if (!process.env.YKP_HR_SPREADSHEET_ID) return true;
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
