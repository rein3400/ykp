/**
 * HR Pilot MEGA mock seed — employees, roster, attendance, payroll, leaves, lateness.
 *
 * Run after bootstrap:
 *   npm run sheets:bootstrap
 *   npm run sheets:mega-seed
 *
 * Idempotent-ish: skip employees by employee_code; append transactional rows
 * (re-run will duplicate roster/attendance/payroll — intended for demo density).
 */
import { getSheetsClient, getSpreadsheetId, TAB_HEADERS, TABS, readTab, appendRows } from '../src/db/sheets';
import { nowTimestampWib, formatDateWib } from '../src/lib/format';
import { createHash } from 'crypto';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (n: number, w = 3) => String(n).padStart(w, '0');
const id = (p: string, n: number) => `MEGA-${p}-${pad(n, 4)}`;
const hashPw = (p: string) => createHash('sha256').update(p).digest('hex');

function dayOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return formatDateWib(d);
}

const MALE_NAMES = ['Budi', 'Andi', 'Joko', 'Rudi', 'Hadi', 'Dedi', 'Fajar', 'Galih', 'Hendra', 'Iwan', 'Jaya', 'Kiki'];
const FEMALE_NAMES = ['Sari', 'Dewi', 'Rina', 'Maya', 'Lina', 'Tuti', 'Wulan', 'Yuni', 'Nisa', 'Ayu', 'Fitri', 'Kartini'];

const ROLES = ['owner', 'admin', 'supervisor', 'staff', 'finance_admin'];
const DEPARTMENTS = ['Kitchen', 'Service', 'Cashier', 'Bar', 'Admin', 'Finance'];
const POSITIONS = ['Head Chef', 'Cook', 'Waitress', 'Cashier', 'Barista', 'Supervisor', 'Admin', 'Finance Staff'];

const EMPLOYEES = Array.from({ length: 12 }, (_, i) => {
  const isMale = i % 2 === 0;
  const firstName = isMale ? MALE_NAMES[i] : FEMALE_NAMES[i];
  const lastName = ['Santoso', 'Wijaya', 'Kusuma', 'Pratama', 'Sari', 'Dewi'][i % 6];
  const gender = isMale ? 'MALE' : 'FEMALE';
  const role = ROLES[(i % (ROLES.length - 1)) + 1]; // skip owner
  const dept = DEPARTMENTS[i % DEPARTMENTS.length];
  const position = POSITIONS[i % POSITIONS.length];
  const salary = 4_000_000 + (i % 6) * 500_000;
  return {
    employee_id: id('EMP', i + 1),
    employee_code: `EMP-MEGA-${pad(i + 1, 3)}`,
    full_name: `${firstName} ${lastName}`,
    nickname: firstName,
    gender,
    phone: `0812${pad(1000 + i, 4)}${pad(1000 + i, 4)}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@ykp.local`,
    telegram_id: '',
    address: `Jl. Cipete Raya No. ${10 + i}`,
    date_of_birth: `199${i % 10}-0${(i % 9) + 1}-15`,
    join_date: dayOffset(180 + i * 10),
    employment_status: 'PERMANENT',
    contract_type: 'PKWTT',
    department: dept,
    role,
    position,
    brand_id: '', // filled from sheet
    outlet_id: '', // filled from sheet
    supervisor_id: '',
    basic_salary: String(salary),
    salary_type: 'MONTHLY',
    bank_name: 'BCA',
    bank_account: `12345678${pad(i + 1, 4)}`,
    account_holder: `${firstName} ${lastName}`,
    bpjs_status: 'YES',
    tax_status: 'YES',
    emergency_contact_name: `Ibu ${firstName}`,
    emergency_contact_phone: `0812${pad(2000 + i, 4)}${pad(2000 + i, 4)}`,
    photo_url: '',
    active_status: 'active',
  };
});

async function appendBatched(tab: (typeof TABS)[keyof typeof TABS], rows: Record<string, string>[], size = 40) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    await appendRows(tab, chunk);
    console.log(`  [${tab}] +${chunk.length} (${Math.min(i + size, rows.length)}/${rows.length})`);
    await sleep(1200);
  }
}

async function main() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.YKP_HR_SPREADSHEET_ID) {
    throw new Error('Need GOOGLE_SERVICE_ACCOUNT_EMAIL + YKP_HR_SPREADSHEET_ID');
  }
  process.env.USE_MOCK_DB = 'false';
  const now = nowTimestampWib();
  console.log('[hr mega-seed] spreadsheet', getSpreadsheetId());

  const existingBrands = await readTab(TABS.brands);
  const existingOutlets = await readTab(TABS.outlets);
  const existingShifts = await readTab(TABS.shifts);
  const existingEmployees = await readTab(TABS.employees);

  const brandId = existingBrands[0]?.brand_id || 'BR-001';
  const outletId = existingOutlets[0]?.outlet_id || 'OL-001';
  const shifts = existingShifts.filter((s) => s.active_status === 'active' || s.active_status === '');
  const shiftIds = shifts.length ? shifts.map((s) => s.shift_id) : ['SH-001', 'SH-002', 'SH-003'];

  // Ensure master shifts exist
  if (!shifts.length) {
    const shiftRows = [
      { shift_id: 'SH-001', shift_name: 'Pagi', brand_id: brandId, outlet_id: outletId, start_time: '07:00', end_time: '15:00', break_minutes: '30', late_tolerance_minutes: '10', overtime_rule_id: '', active_status: 'active', created_at: now },
      { shift_id: 'SH-002', shift_name: 'Siang', brand_id: brandId, outlet_id: outletId, start_time: '12:00', end_time: '20:00', break_minutes: '30', late_tolerance_minutes: '10', overtime_rule_id: '', active_status: 'active', created_at: now },
      { shift_id: 'SH-003', shift_name: 'Split', brand_id: brandId, outlet_id: outletId, start_time: '10:00', end_time: '14:00', break_minutes: '0', late_tolerance_minutes: '10', overtime_rule_id: '', active_status: 'active', created_at: now },
      { shift_id: 'SH-004', shift_name: 'Malam', brand_id: brandId, outlet_id: outletId, start_time: '20:00', end_time: '04:00', break_minutes: '30', late_tolerance_minutes: '10', overtime_rule_id: '', active_status: 'active', created_at: now },
    ];
    await appendBatched(TABS.shifts, shiftRows);
  }

  // Employees
  const existingCodes = new Set(existingEmployees.map((e) => e.employee_code));
  const newEmployees = EMPLOYEES.filter((e) => !existingCodes.has(e.employee_code)).map((e) => ({
    ...e,
    brand_id: brandId,
    outlet_id: outletId,
    created_at: now,
    updated_at: now,
    created_by: 'USR-001',
    updated_by: 'USR-001',
  }));
  if (newEmployees.length) await appendBatched(TABS.employees, newEmployees);

  const allEmployees = await readTab(TABS.employees);
  const activeEmployees = allEmployees.filter((e) => e.active_status === 'active');
  if (activeEmployees.length === 0) throw new Error('No active employees after seed');

  // Roster 30 days
  const roster: Record<string, string>[] = [];
  for (let d = 29; d >= 0; d--) {
    const date = dayOffset(d);
    activeEmployees.forEach((emp, i) => {
      const shiftId = shiftIds[i % shiftIds.length];
      roster.push({
        roster_id: id('ROS', roster.length + 1),
        date,
        employee_id: emp.employee_id,
        brand_id: brandId,
        outlet_id: outletId,
        shift_id: shiftId,
        role: emp.role,
        roster_status: 'CONFIRMED',
        replacement_employee_id: '',
        swap_request_id: '',
        approved_by: 'USR-001',
        notes: 'MEGA seed roster',
        created_at: now,
      });
    });
  }
  await appendBatched(TABS.roster, roster, 40);

  // Attendance 30 days
  const attendance: Record<string, string>[] = [];
  const lateness: Record<string, string>[] = [];
  for (let d = 29; d >= 0; d--) {
    const date = dayOffset(d);
    activeEmployees.forEach((emp, i) => {
      const shiftId = shiftIds[i % shiftIds.length];
      const shift = shifts.find((s) => s.shift_id === shiftId) || existingShifts.find((s) => s.shift_id === shiftId);
      const scheduledIn = shift?.start_time || '07:00';
      const scheduledOut = shift?.end_time || '15:00';
      const late = Math.random() < 0.15 ? Math.floor(Math.random() * 30) + 1 : 0;
      const early = Math.random() < 0.1 ? Math.floor(Math.random() * 20) + 1 : 0;
      const [inH, inM] = scheduledIn.split(':').map(Number);
      const actualInMin = inH * 60 + inM + late;
      const actualIn = `${String(Math.floor(actualInMin / 60)).padStart(2, '0')}:${String(actualInMin % 60).padStart(2, '0')}`;
      const [outH, outM] = scheduledOut.split(':').map(Number);
      const actualOutMin = outH * 60 + outM - early;
      const actualOut = `${String(Math.floor(actualOutMin / 60) % 24).padStart(2, '0')}:${String(actualOutMin % 60).padStart(2, '0')}`;
      const status = late > 10 ? 'LATE' : early > 10 ? 'EARLY_LEAVE' : 'PRESENT';
      attendance.push({
        attendance_id: id('ATT', attendance.length + 1),
        date,
        employee_id: emp.employee_id,
        employee_name: emp.full_name,
        brand_id: brandId,
        outlet_id: outletId,
        shift_id: shiftId,
        scheduled_check_in: scheduledIn,
        actual_check_in: actualIn,
        scheduled_check_out: scheduledOut,
        actual_check_out: actualOut,
        check_in_location: 'Cipete',
        check_out_location: 'Cipete',
        latitude: '-6.1234',
        longitude: '106.1234',
        attendance_radius_m: '100',
        check_in_photo_url: '',
        check_out_photo_url: '',
        attendance_status: status,
        late_minutes: String(late),
        early_leave_minutes: String(early),
        overtime_minutes: '0',
        correction_id: '',
        correction_status: '',
        correction_type: '',
        correction_reason: '',
        corrected_clock_in: '',
        corrected_clock_out: '',
        corrected_status: '',
        correction_photo_url: '',
        correction_latitude: '',
        correction_longitude: '',
        correction_requested_by: '',
        correction_requested_at: '',
        correction_approved_by: '',
        correction_approved_at: '',
        approved_by: 'USR-001',
        notes: 'MEGA seed attendance',
        created_at: now,
        updated_at: now,
      });
      if (late > 0) {
        lateness.push({
          lateness_id: id('LATE', lateness.length + 1),
          date,
          employee_id: emp.employee_id,
          outlet_id: outletId,
          shift_id: shiftId,
          scheduled_time: scheduledIn,
          actual_time: actualIn,
          late_minutes: String(late),
          tolerance_minutes: '10',
          payable_late_minutes: String(Math.max(0, late - 10)),
          penalty_rule_id: 'LR-001',
          penalty_amount: String(Math.max(0, late - 10) * 1000),
          reason: 'Traffic',
          approval_status: 'APPROVED',
          approved_by: 'USR-001',
          created_at: now,
        });
      }
    });
  }
  await appendBatched(TABS.attendance, attendance, 40);
  if (lateness.length) await appendBatched(TABS.lateness, lateness, 40);

  // Payroll 3 periods
  const payroll: Record<string, string>[] = [];
  const periods = [dayOffset(60).slice(0, 7), dayOffset(30).slice(0, 7), dayOffset(0).slice(0, 7)];
  for (const period of periods) {
    activeEmployees.forEach((emp) => {
      const basic = Number(emp.basic_salary) || 4_500_000;
      const absentDays = Math.floor(Math.random() * 2);
      const paidLeave = 0;
      const unpaidLeave = absentDays;
      const attendanceDays = 26 - absentDays - unpaidLeave;
      const lateMins = Math.floor(Math.random() * 60);
      const attendanceDeduction = (lateMins * 1000) + (absentDays * 200_000);
      const overtimeHours = Math.floor(Math.random() * 5);
      const overtimePay = overtimeHours * 50_000;
      const bonus = Math.floor(Math.random() * 500_000);
      const penalty = 0;
      const allowance = 300_000;
      const bpjs = Math.round(basic * 0.03);
      const tax = Math.round(basic * 0.05);
      const gross = basic + overtimePay + bonus + allowance;
      const net = gross - attendanceDeduction - bpjs - tax;
      payroll.push({
        payroll_id: id('PAY', payroll.length + 1),
        payroll_period: period,
        employee_id: emp.employee_id,
        employee_name: emp.full_name,
        brand_id: brandId,
        outlet_id: outletId,
        basic_salary: String(basic),
        attendance_days: String(attendanceDays),
        absent_days: String(absentDays),
        paid_leave_days: String(paidLeave),
        unpaid_leave_days: String(unpaidLeave),
        late_minutes: String(lateMins),
        attendance_deduction: String(attendanceDeduction),
        overtime_hours: String(overtimeHours),
        overtime_pay: String(overtimePay),
        bonus_total: String(bonus),
        penalty_total: String(penalty),
        allowance_total: String(allowance),
        cash_advance_deduction: '0',
        bpjs_deduction: String(bpjs),
        tax_deduction: String(tax),
        other_deduction: '0',
        gross_salary: String(gross),
        net_salary: String(net),
        calculation_status: 'CALCULATED',
        approval_status: 'APPROVED',
        payment_status: 'PENDING',
        locked_status: 'UNLOCKED',
        locked_at: '',
        locked_by: '',
        unlock_reason: '',
        unlock_approved_by: '',
        payment_date: '',
        payment_reference: '',
        payslip_url: '',
        approved_by: 'USR-001',
        created_at: now,
        updated_at: now,
      });
    });
  }
  await appendBatched(TABS.payroll, payroll, 40);

  // Leaves
  const leaves: Record<string, string>[] = [];
  const leaveTypes = ['ANNUAL', 'SICK', 'UNPAID'];
  activeEmployees.slice(0, 5).forEach((emp, i) => {
    const start = dayOffset(5 + i * 3);
    const end = dayOffset(3 + i * 3);
    leaves.push({
      leave_id: id('LEV', i + 1),
      employee_id: emp.employee_id,
      employee_name: emp.full_name,
      leave_type: leaveTypes[i % leaveTypes.length],
      start_date: start,
      end_date: end,
      total_days: String(3),
      reason: 'MEGA seed leave',
      attachment_url: '',
      doctor_letter_url: '',
      submitted_at: dayOffset(7 + i * 3),
      approval_status: 'APPROVED',
      approved_by: 'USR-001',
      approved_at: dayOffset(6 + i * 3),
      rejection_reason: '',
      notes: '',
      created_at: now,
    });
  });
  await appendBatched(TABS.leaves, leaves, 20);

  // Daily summary last 30 days
  const summaries: Record<string, string>[] = [];
  for (let d = 29; d >= 0; d--) {
    const date = dayOffset(d);
    const present = activeEmployees.length - Math.floor(Math.random() * 3);
    const late = Math.floor(Math.random() * 3);
    const absent = activeEmployees.length - present;
    summaries.push({
      summary_id: id('SUM', summaries.length + 1),
      date,
      brand_id: brandId,
      brand_name: existingBrands[0]?.brand_name || 'Funkydak',
      outlet_id: outletId,
      outlet_name: existingOutlets[0]?.outlet_name || 'Cipete',
      total_staff: String(activeEmployees.length),
      scheduled_staff: String(activeEmployees.length),
      staff_present: String(present),
      staff_late: String(late),
      staff_absent: String(absent),
      staff_leave: '0',
      incomplete_attendance: '0',
      total_late_minutes: String(late * 15),
      overtime_hours: '0',
      shift_shortage: '0',
      payroll_issue_count: '0',
      major_hr_issue: '',
      recommended_action: '',
      created_at: now,
    });
  }
  await appendBatched(TABS.dailySummary, summaries, 40);

  // Extra users
  const users = [
    { user_id: 'USR-HR-002', username: 'admin', password: 'admin123', role: 'admin', brand_id: brandId, outlet_id: outletId },
    { user_id: 'USR-HR-003', username: 'supervisor', password: 'supervisor123', role: 'supervisor', brand_id: brandId, outlet_id: outletId },
    { user_id: 'USR-HR-004', username: 'staff1', password: 'staff123', role: 'staff', brand_id: brandId, outlet_id: outletId },
  ];
  const existingUsers = await readTab(TABS.users);
  const unames = new Set(existingUsers.map((u) => u.username));
  await appendBatched(
    TABS.users,
    users
      .filter((u) => !unames.has(u.username))
      .map((u) => ({
        user_id: u.user_id,
        username: u.username,
        password_hash: hashPw(u.password),
        role: u.role,
        brand_id: u.brand_id,
        outlet_id: u.outlet_id,
        active_status: 'active',
        created_at: now,
        last_login_at: '',
      }))
  );

  console.log('[hr mega-seed] DONE');
  console.log({
    employees: newEmployees.length,
    roster: roster.length,
    attendance: attendance.length,
    lateness: lateness.length,
    payroll: payroll.length,
    leaves: leaves.length,
    summaries: summaries.length,
  });
  console.log('Logins: owner/owner123 | admin/admin123 | supervisor/supervisor123 | staff1/staff123');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
