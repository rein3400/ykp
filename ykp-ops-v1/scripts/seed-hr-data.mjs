/**
 * Comprehensive HR data seeder for ykp-hr-v1 (Google Sheets).
 * Seeds:
 *   - hr_attendance: 30 days × 8 employees = 240 records
 *   - hr_roster: 30 days × 8 employees = 240 records
 *   - hr_lateness: ~30 records
 *   - hr_leave_request: 16 records (2 per employee)
 *   - hr_adjustment: 24 records (3 per employee)
 *   - hr_payroll: 8 records (1 per employee, current month)
 *   - hr_daily_summary: 30 records (1 per day)
 *   - audit_log: 50 records
 * Run: node scripts/seed-hr-data.mjs
 */
import { google } from "googleapis";
import fs from "node:fs";

const CRED_PATH = "D:/Users/stefa/Downloads/ykp-hr-v1-7786e7ed8655.json";
const SHEET_ID = "1rdKV6BJMsDr3lKhIoxQXA8hbto9s8p0rOajHFYNsPVg";
const N = 30; // days
const EMPLOYEES = [
  { id: "EMP-001", name: "Sari Wijaya", outlet: "OL-001", brand: "BR-001", baseSalary: 4500000 },
  { id: "EMP-002", name: "Budi Santoso", outlet: "OL-001", brand: "BR-001", baseSalary: 4500000 },
  { id: "EMP-003", name: "Citra Lestari", outlet: "OL-001", brand: "BR-001", baseSalary: 5500000 },
  { id: "EMP-004", name: "Dewi Anggraini", outlet: "OL-001", brand: "BR-001", baseSalary: 7500000 },
  { id: "EMP-005", name: "Hadi Pranata", outlet: "OL-001", brand: "BR-001", baseSalary: 4200000 },
  { id: "EMP-006", name: "Lina Kusuma", outlet: "OL-001", brand: "BR-001", baseSalary: 4200000 },
  { id: "EMP-007", name: "Rudi Hartono", outlet: "OL-001", brand: "BR-001", baseSalary: 4500000 },
  { id: "EMP-008", name: "Maya Sari", outlet: "OL-001", brand: "BR-001", baseSalary: 4500000 },
];
const SHIFTS = [
  { id: "SH-001", name: "Pagi", start: "07:00", end: "15:00" },
  { id: "SH-002", name: "Siang", start: "12:00", end: "20:00" },
  { id: "SH-003", name: "Split", start: "10:00", end: "14:00" },
  { id: "SH-004", name: "Malam", start: "20:00", end: "04:00" },
];
const LEAVE_TYPES = ["ANNUAL_LEAVE", "SICK", "PERMISSION", "UNPAID_LEAVE", "EMERGENCY", "MATERNITY"];
const ADJUSTMENT_TYPES = ["BONUS", "PENALTY", "OVERTIME", "ALLOWANCE", "CASH_ADVANCE", "REIMBURSEMENT"];
const ADJUSTMENT_STATUSES = ["PENDING", "APPROVED", "APPROVED", "APPROVED", "REJECTED"];
const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "PRESENT", "PRESENT", "ABSENT", "LEAVE", "SICK", "PRESENT"];

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dateStr(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}
function dateTime(daysBack, time) {
  return `${dateStr(daysBack)}T${time}:00`;
}
function nowWib() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

async function main() {
  const creds = JSON.parse(fs.readFileSync(CRED_PATH, "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  // 1. ATTENDANCE: 30 days × 8 employees = 240 records
  const attendanceRows = [];
  let attId = 1;
  for (let d = 0; d < N; d++) {
    const date = dateStr(d);
    for (const emp of EMPLOYEES) {
      const shift = randomChoice(SHIFTS);
      const status = randomChoice(ATTENDANCE_STATUSES);
      const isLate = status === "LATE";
      const isAbsent = status === "ABSENT" || status === "LEAVE" || status === "SICK";
      const lateMin = isLate ? randomInt(5, 45) : 0;
      const checkIn = isAbsent ? "" : dateTime(d, shift.start.split(":")[0] === "20" ? "20" : shift.start);
      const checkOut = isAbsent ? "" : dateTime(d, shift.end.split(":")[0] === "04" ? "04" : shift.end);
      const otMin = !isAbsent && Math.random() > 0.7 ? randomInt(15, 60) : 0;
      attendanceRows.push([
        `ATT-${String(attId++).padStart(5, "0")}`,
        date,
        emp.id,
        emp.name,
        emp.brand,
        emp.outlet,
        shift.id,
        dateTime(d, shift.start),
        checkIn,
        dateTime(d, shift.end),
        checkOut,
        "-6.2789",
        "106.7925",
        "100",
        "",
        "",
        status,
        lateMin,
        "0",
        otMin,
        "",
        "",
        "system",
        "",
        nowWib(),
        nowWib(),
      ]);
    }
  }
  console.log(`attendance: ${attendanceRows.length}`);

  // 2. ROSTER: 30 days × 8 employees
  const rosterRows = [];
  let rId = 1;
  for (let d = 0; d < N; d++) {
    const date = dateStr(d);
    for (const emp of EMPLOYEES) {
      const shift = randomChoice(SHIFTS);
      rosterRows.push([
        `RST-${String(rId++).padStart(5, "0")}`,
        date,
        emp.id,
        emp.brand,
        emp.outlet,
        shift.id,
        emp.id === "EMP-003" ? "supervisor" : "staff",
        randomChoice(["SCHEDULED", "CONFIRMED", "COMPLETED", "COMPLETED"]),
        "",
        "",
        "owner",
        "",
        nowWib(),
      ]);
    }
  }
  console.log(`roster: ${rosterRows.length}`);

  // 3. LATENESS: ~30 records
  const latenessRows = [];
  let lId = 1;
  for (let i = 0; i < 30; i++) {
    const emp = randomChoice(EMPLOYEES);
    const d = randomInt(0, 29);
    const shift = randomChoice(SHIFTS);
    const lateMin = randomInt(5, 60);
    latenessRows.push([
      `LAT-${String(lId++).padStart(5, "0")}`,
      dateStr(d),
      emp.id,
      emp.outlet,
      shift.id,
      dateTime(d, shift.start),
      dateTime(d, `${parseInt(shift.start.split(":")[0]) + (lateMin >= 60 ? 1 : 0)}:${(parseInt(shift.start.split(":")[1]) + lateMin) % 60}`),
      lateMin,
      "10",
      Math.max(0, lateMin - 10),
      "LR-001",
      lateMin * 5000,
      "Lalu lintas padat",
      randomChoice(["PENDING", "APPROVED", "APPROVED"]),
      "owner",
      nowWib(),
    ]);
  }
  console.log(`lateness: ${latenessRows.length}`);

  // 4. LEAVES: 2 per employee = 16
  const leaveRows = [];
  let lvId = 1;
  for (const emp of EMPLOYEES) {
    for (let i = 0; i < 2; i++) {
      const startD = randomInt(5, 25);
      const duration = randomInt(1, 3);
      const startDate = dateStr(startD);
      const endDate = dateStr(startD - duration);
      const lt = randomChoice(LEAVE_TYPES);
      const status = randomChoice(["PENDING", "APPROVED", "APPROVED", "REJECTED"]);
      leaveRows.push([
        `LV-${String(lvId++).padStart(5, "0")}`,
        emp.id,
        lt,
        startDate,
        endDate,
        String(duration + 1),
        `Keperluan ${lt.toLowerCase()}`,
        "",
        nowWib(),
        status,
        "owner",
        status === "REJECTED" ? "" : nowWib(),
        status === "REJECTED" ? "Tidak disetujui" : "",
        "",
        nowWib(),
      ]);
    }
  }
  console.log(`leaves: ${leaveRows.length}`);

  // 5. ADJUSTMENTS: 3 per employee = 24
  const adjRows = [];
  let aId = 1;
  for (const emp of EMPLOYEES) {
    for (let i = 0; i < 3; i++) {
      const type = randomChoice(ADJUSTMENT_TYPES);
      const amount = type === "BONUS" || type === "OVERTIME" ? randomInt(100000, 1000000) : randomInt(50000, 300000);
      const d = randomInt(0, 29);
      adjRows.push([
        `ADJ-${String(aId++).padStart(5, "0")}`,
        dateStr(d),
        emp.id,
        type,
        type === "BONUS" ? "Performance bonus" : type === "OVERTIME" ? "Lembur weekend" : type === "PENALTY" ? "Terlambat" : type,
        String(amount),
        "1",
        "IDR",
        type === "PENALTY" ? "Datang telat 30 menit" : `Adjustment ${type.toLowerCase()}`,
        "",
        randomChoice(ADJUSTMENT_STATUSES),
        "owner",
        "2026-07",
        "system",
        nowWib(),
      ]);
    }
  }
  console.log(`adjustments: ${adjRows.length}`);

  // 6. PAYROLL: 1 per employee for current month
  const payrollRows = [];
  let pId = 1;
  for (const emp of EMPLOYEES) {
    const attDays = randomInt(25, 30);
    const absent = 30 - attDays;
    const lateMin = randomInt(0, 60);
    const overtime = randomInt(0, 10);
    const base = emp.baseSalary;
    const daily = Math.floor(base / 25);
    const attendanceBase = daily * attDays;
    const lateDed = Math.floor((lateMin / 60) * 50000);
    const overtimePay = Math.floor(overtime * Math.floor(daily / 8) * 1.5);
    const bonus = randomInt(0, 200000);
    const gross = attendanceBase + overtimePay + bonus;
    const tax = Math.floor(gross * 0.05);
    const net = gross - lateDed - tax;
    payrollRows.push([
      `PAY-${emp.id}-202607`,
      emp.id,
      emp.name,
      emp.brand,
      emp.outlet,
      "2026-07-01",
      "2026-07-31",
      "30",
      String(attDays),
      String(absent),
      "0",
      "0",
      String(lateMin),
      String(lateDed),
      String(overtime),
      String(overtimePay),
      String(bonus),
      "0",
      "0",
      "0",
      "0",
      String(gross),
      String(net),
      "owner",
      "APPROVED",
      nowWib(),
    ]);
  }
  console.log(`payroll: ${payrollRows.length}`);

  // 7. DAILY SUMMARY: 30 days
  const summaryRows = [];
  let sId = 1;
  for (let d = 0; d < N; d++) {
    const date = dateStr(d);
    const present = randomInt(6, 8);
    const late = randomInt(0, 3);
    const absent = 8 - present;
    summaryRows.push([
      `SUM-${String(sId++).padStart(5, "0")}`,
      date,
      "BR-001",
      "Funkydak Cipete",
      "BR-001",
      "OL-001",
      "8",
      String(present),
      String(late),
      String(absent),
      absent > 1 ? "yes" : "no",
      absent > 0 ? `${absent} staff absent` : "none",
      "Review roster",
      nowWib(),
    ]);
  }
  console.log(`summary: ${summaryRows.length}`);

  // 8. AUDIT LOG: 50
  const auditRows = [];
  const actions = ["create", "update", "delete", "approve"];
  const entities = ["employee", "payroll", "expense", "supplier", "attendance"];
  for (let i = 0; i < 50; i++) {
    auditRows.push([
      String(i + 1),
      randomChoice(["owner", "U-EMP-4", "U-EMP-3"]),
      randomChoice(actions),
      randomChoice(entities),
      `ENT-${randomInt(1000, 9999)}`,
      JSON.stringify({}),
      JSON.stringify({}),
      "Routine operation",
      nowWib(),
    ]);
  }
  console.log(`audit: ${auditRows.length}`);

  // Clear existing data first (preserves users tab)
  const tabsToClear = [
    "hr_attendance", "hr_roster", "hr_lateness", "hr_leave_request",
    "hr_adjustment", "hr_payroll", "hr_daily_summary", "audit_log",
  ];
  console.log("\nClearing existing data...");
  for (const tab of tabsToClear) {
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SHEET_ID,
        range: `${tab}!A2:Z1000`,
      });
    } catch (e) { /* ignore */ }
  }

  // Write data
  console.log("Writing data...");
  const writes = [
    { tab: "hr_attendance", data: attendanceRows },
    { tab: "hr_roster", data: rosterRows },
    { tab: "hr_lateness", data: latenessRows },
    { tab: "hr_leave_request", data: leaveRows },
    { tab: "hr_adjustment", data: adjRows },
    { tab: "hr_payroll", data: payrollRows },
    { tab: "hr_daily_summary", data: summaryRows },
    { tab: "audit_log", data: auditRows },
  ];

  for (const w of writes) {
    if (w.data.length === 0) continue;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${w.tab}!A2`,
      valueInputOption: "RAW",
      requestBody: { values: w.data },
    });
    console.log(`  ${w.tab}: ${w.data.length} rows`);
  }

  console.log("\n=== SUMMARY ===");
  console.log(`attendance: ${attendanceRows.length}`);
  console.log(`roster: ${rosterRows.length}`);
  console.log(`lateness: ${latenessRows.length}`);
  console.log(`leaves: ${leaveRows.length}`);
  console.log(`adjustments: ${adjRows.length}`);
  console.log(`payroll: ${payrollRows.length}`);
  console.log(`summary: ${summaryRows.length}`);
  console.log(`audit: ${auditRows.length}`);
  console.log(`TOTAL: ${attendanceRows.length + rosterRows.length + latenessRows.length + leaveRows.length + adjRows.length + payrollRows.length + summaryRows.length + auditRows.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
