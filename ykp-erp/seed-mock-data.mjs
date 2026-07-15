/**
 * Comprehensive mock data seeder for YKP ERP.
 * Run: node seed-mock-data.mjs
 * Inserts:
 *   - 5 brands
 *   - 15 outlets (3 per brand)
 *   - 10 shifts
 *   - 10 expense categories
 *   - 10 payment methods
 *   - 15 petty cash accounts
 *   - 50 employees (10 per brand, multiple roles)
 *   - 5 supplier categories
 *   - 20 suppliers
 *   - 10 HR rules (shift configs)
 *   - 30 days × 15 outlets = 450 attendance records
 *   - 30 days × 15 outlets = 450 POS daily records
 *   - 30 days × 15 outlets = 150 expense records
 *   - 30 days × 15 outlets = 100 supplier cost records
 *   - 30 days × 15 outlets = 200 petty cash records
 *   - 30 days × 15 outlets = 450 daily summaries (hr + finance)
 *   - 30 days × 15 outlets = 200 alerts
 *   - 30 daily briefs
 *   - 6 hermez config entries
 *   - Audit log entries
 */
import postgres from "postgres";

const URL = process.env.YKP_DATABASE_URL;
if (!URL) {
  console.error("Set YKP_DATABASE_URL");
  process.exit(1);
}
const sql = postgres(URL, { max: 1, ssl: { rejectUnauthorized: false } });

const BRANDS = [
  { id: "BR-001", code: "FKD", name: "Funkydak" },
  { id: "BR-002", code: "SKP", name: "Sekarpizza" },
  { id: "BR-003", code: "SBN", name: "Suburbuns" },
  { id: "BR-004", code: "LJK", name: "Laju Kopi" },
  { id: "BR-005", code: "UMS", name: "Uncle Masala" },
];

const OUTLETS_PER_BRAND = 3;
const OUTLET_NAMES = ["Sudirman", "Kemang", "Senopati", "Cipete", "Pondok Indah", "Cikini", "Bintaro", "Kelapa Gading", "PIK", "Bekasi", "Depok", "Bandung", "Surabaya", "Medan", "Bali"];
const PICS = ["Budi Santoso", "Sari Wijaya", "Citra Lestari", "Dewi Anggraini", "Hadi Pranata"];
const STREETS = ["Jl. Sudirman No.1", "Jl. Kemang Raya No.10", "Jl. Senopati No.88", "Jl. Cipete Raya No.5", "Jl. Pondok Indah No.12"];

const ROLES = ["staff", "staff", "staff", "staff", "staff", "supervisor", "supervisor", "outlet_manager", "brand_manager", "hr_admin"];
const DEPARTMENTS = ["FOH", "FOH", "Kitchen", "Kitchen", "Cashier", "Operations", "Operations", "Management"];
const POSITIONS = ["Barista", "Server", "Chef", "Cook Helper", "Cashier", "Shift Leader", "Supervisor", "Outlet Manager"];
const FIRST_NAMES = ["Ayu", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hadi", "Indra", "Joko", "Kiki", "Lia", "Made", "Nia", "Oki", "Putri", "Rini", "Sari", "Tono", "Umi", "Vina", "Wahyu", "Yani", "Zara"];
const LAST_NAMES = ["Lestari", "Wijaya", "Santoso", "Anggraini", "Pranata", "Wibawa", "Kusuma", "Hartono", "Saputra", "Pratiwi", "Sukma", "Permata", "Laksmi", "Handayani", "Setiawan"];

const SUPPLIER_CATEGORIES = ["Bahan Pokok", "Sayuran", "Daging", "Bumbu", "Minuman", "Kemasan", "Alat Kebersihan", "Lain-lain"];
const SUPPLIER_NAMES = ["PT Sinar Jaya", "CV Makmur Sentosa", "Toko Sumber Rezeki", "UD Berkah Tani", "PT Indofood", "PT Unilever", "CV Maju Bersama", "Toko Tani Makmur", "PT Aqua", "PT Coca-Cola", "PT Sosro", "PT Djarum", "Toko Plastik Jaya", "Toko Sabun Jaya", "Toko Bumbu Dapur", "PT Sumber Protein", "CV Sayur Segar", "PT Daging Nusantara", "CV Frozen Food", "Toko Serba Ada"];

const EXPENSE_CATEGORIES = ["Gaji", "Sewa", "Listrik", "Air", "Internet", "Bahan Baku", "Peralatan", "Marketing", "Transportasi", "Lain-lain"];
const PAYMENT_METHODS = ["Cash", "BCA Transfer", "Mandiri Transfer", "BNI Transfer", "GoPay", "OVO", "DANA", "ShopeePay", "QRIS", "Kartu Kredit"];
const SHIFTS = [
  { id: "SH-001", name: "Pagi", start: "07:00", end: "15:00" },
  { id: "SH-002", name: "Siang", start: "12:00", end: "20:00" },
  { id: "SH-003", name: "Split", start: "10:00", end: "14:00" },
  { id: "SH-004", name: "Malam", start: "20:00", end: "04:00" },
  { id: "SH-005", name: "Weekend", start: "10:00", end: "22:00" },
];

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomDate(daysBack = 30) {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, daysBack));
  return d.toISOString().slice(0, 10);
}
function randomTimestamp(daysBack = 30) {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, daysBack));
  d.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59));
  return d.toISOString();
}
function nowWib() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

async function clear() {
  console.log("Clearing existing mock data...");
  await sql`TRUNCATE master.master_employee CASCADE`;
  await sql`TRUNCATE master.master_outlet CASCADE`;
  await sql`TRUNCATE master.master_supplier CASCADE`;
  await sql`TRUNCATE master.master_brand CASCADE`;
  await sql`TRUNCATE master.master_shift CASCADE`;
  await sql`TRUNCATE master.hr_rules CASCADE`;
  await sql`TRUNCATE master.fin_expense_category CASCADE`;
  await sql`TRUNCATE master.fin_payment_method CASCADE`;
  await sql`TRUNCATE master.fin_petty_cash_account CASCADE`;
  await sql`TRUNCATE finance.fin_closing_cash CASCADE`;
  await sql`TRUNCATE finance.fin_daily_summary CASCADE`;
  await sql`TRUNCATE finance.fin_expense CASCADE`;
  await sql`TRUNCATE finance.fin_opening_balance CASCADE`;
  await sql`TRUNCATE finance.fin_petty_cash CASCADE`;
  await sql`TRUNCATE finance.fin_pos_daily CASCADE`;
  await sql`TRUNCATE finance.fin_supplier_cost CASCADE`;
  await sql`TRUNCATE finance.audit_log CASCADE`;
  await sql`TRUNCATE hr.hr_attendance CASCADE`;
  await sql`TRUNCATE hr.hr_daily_summary CASCADE`;
  await sql`TRUNCATE hr.hr_payroll CASCADE`;
  await sql`TRUNCATE hr.hr_payroll_line CASCADE`;
  await sql`TRUNCATE hr.audit_log CASCADE`;
  await sql`TRUNCATE hermez.hermez_alert_log CASCADE`;
  await sql`TRUNCATE hermez.hermez_config CASCADE`;
  await sql`TRUNCATE hermez.hermez_daily_brief CASCADE`;
  await sql`TRUNCATE hermez.audit_log CASCADE`;
}

async function seedBrands() {
  console.log("Seeding brands...");
  for (const b of BRANDS) {
    await sql`INSERT INTO master.master_brand (brand_id, brand_code, brand_name, status, created_at, updated_at) VALUES (${b.id}, ${b.code}, ${b.name}, 'active', ${nowWib()}, ${nowWib()})`;
  }
}

async function seedOutlets() {
  console.log("Seeding outlets...");
  let i = 0;
  for (const b of BRANDS) {
    for (let j = 0; j < OUTLETS_PER_BRAND; j++) {
      const id = `OL-${String(i + 1).padStart(3, "0")}`;
      const name = `${b.name} ${OUTLET_NAMES[i] || `Outlet ${j + 1}`}`;
      const code = `${b.code}-${OUTLET_NAMES[i]?.split(" ")[0]?.toUpperCase().slice(0, 3) || "OTL"}${j + 1}`;
      const street = STREETS[i % STREETS.length];
      const pic = PICS[i % PICS.length];
      const tz = "Asia/Jakarta";
      const open = "08:00", close = "22:00";
      await sql`INSERT INTO master.master_outlet (outlet_id, brand_id, outlet_name, outlet_code, address, opening_time, closing_time, timezone, pic_outlet, status, created_at, updated_at) VALUES (${id}, ${b.id}, ${name}, ${code}, ${street}, ${open}, ${close}, ${tz}, ${pic}, 'active', ${nowWib()}, ${nowWib()})`;
      i++;
    }
  }
}

async function seedShifts() {
  console.log("Seeding shifts...");
  for (const s of SHIFTS) {
    await sql`INSERT INTO master.master_shift (shift_id, shift_name, start_time, end_time, status, created_at, updated_at) VALUES (${s.id}, ${s.name}, ${s.start}, ${s.end}, 'active', ${nowWib()}, ${nowWib()})`;
  }
}

async function seedPaymentMethods() {
  console.log("Seeding payment methods...");
  for (let i = 0; i < PAYMENT_METHODS.length; i++) {
    const m = PAYMENT_METHODS[i];
    const id = `PM-${String(i + 1).padStart(3, "0")}`;
    const isCash = m === "Cash" || m === "QRIS";
    await sql`INSERT INTO master.fin_payment_method (method_id, method_name, is_cash, status, created_at, updated_at) VALUES (${id}, ${m}, ${isCash}, 'active', ${nowWib()}, ${nowWib()})`;
  }
}

async function seedExpenseCategories() {
  console.log("Seeding expense categories...");
  for (let i = 0; i < EXPENSE_CATEGORIES.length; i++) {
    const c = EXPENSE_CATEGORIES[i];
    const id = `EC-${String(i + 1).padStart(3, "0")}`;
    const type = c === "Gaji" ? "OPEX" : c === "Sewa" || c === "Listrik" || c === "Air" ? "OPEX" : "COGS";
    await sql`INSERT INTO master.fin_expense_category (category_id, category_name, account_type, status, created_at, updated_at) VALUES (${id}, ${c}, ${type}, 'active', ${nowWib()}, ${nowWib()})`;
  }
}

async function seedPettyCashAccounts() {
  console.log("Seeding petty cash accounts...");
  for (let i = 0; i < 15; i++) {
    const id = `PCA-${String(i + 1).padStart(3, "0")}`;
    const outletId = `OL-${String(i + 1).padStart(3, "0")}`;
    const name = `Petty Cash ${OUTLET_NAMES[i] || `Outlet ${i + 1}`}`;
    await sql`INSERT INTO master.fin_petty_cash_account (account_id, outlet_id, account_name, currency, status, created_at, updated_at) VALUES (${id}, ${outletId}, ${name}, 'IDR', 'active', ${nowWib()}, ${nowWib()})`;
  }
}

async function seedSuppliers() {
  console.log("Seeding suppliers...");
  for (let i = 0; i < SUPPLIER_NAMES.length; i++) {
    const id = `SUP-${String(i + 1).padStart(3, "0")}`;
    const name = SUPPLIER_NAMES[i];
    const cat = SUPPLIER_CATEGORIES[i % SUPPLIER_CATEGORIES.length];
    await sql`INSERT INTO master.master_supplier (supplier_id, supplier_name, category, contact, bank_name, bank_account, account_holder, status, created_at, updated_at) VALUES (${id}, ${name}, ${cat}, ${randomChoice(PICS)}, 'BCA', '1234567890', ${name}, 'active', ${nowWib()}, ${nowWib()})`;
  }
}

async function seedHRRules() {
  console.log("Seeding HR rules...");
  for (let i = 0; i < 10; i++) {
    const id = `RULE-${String(i + 1).padStart(3, "0")}`;
    const outletId = `OL-${String((i % 15) + 1).padStart(3, "0")}`;
    const shift = SHIFTS[i % SHIFTS.length];
    await sql`INSERT INTO master.hr_rules (rule_id, outlet_id, shift_name, shift_start, shift_end, late_tolerance_minutes, overtime_rate_multiplier, overtime_daily_cap_hours, first_block_hours, early_clockin_tolerance_min, mandatory_checkout, payroll_period_start, payroll_period_end, created_at, updated_at) VALUES (${id}, ${outletId}, ${shift.name}, ${shift.start}, ${shift.end}, ${10 + (i % 3) * 5}, 1.5, 4.0, 1, 30, true, 1, 25, ${nowWib()}, ${nowWib()})`;
  }
}

async function seedEmployees() {
  console.log("Seeding employees...");
  let empId = 1;
  for (const b of BRANDS) {
    for (let i = 0; i < 10; i++) {
      const id = `EMP-${String(empId).padStart(5, "0")}`;
      const fn = randomChoice(FIRST_NAMES);
      const ln = randomChoice(LAST_NAMES);
      const role = randomChoice(ROLES);
      const dept = role === "hr_admin" ? "HR" : role === "brand_manager" ? "Management" : randomChoice(DEPARTMENTS);
      const pos = role === "hr_admin" ? "HR Admin" : role === "brand_manager" ? "Brand Manager" : role === "outlet_manager" ? "Outlet Manager" : role === "supervisor" ? "Supervisor" : randomChoice(POSITIONS);
      const outletIdx = (empId - 1) % 15;
      const outletId = `OL-${String(outletIdx + 1).padStart(3, "0")}`;
      const phone = `+6281${randomInt(10000000, 99999999)}`;
      const tg = `@${fn.toLowerCase()}.${ln.toLowerCase()}`;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}@ykp.local`;
      const joinDate = randomDate(365);
      const baseSalary = role === "hr_admin" ? 7500000 : role === "brand_manager" ? 6500000 : role === "outlet_manager" ? 5500000 : role === "supervisor" ? 4500000 : 3500000 + randomInt(0, 5) * 250000;
      const empType = role === "hr_admin" || role === "brand_manager" || role === "outlet_manager" ? "permanent" : "contract";
      const status = "active";
      await sql`INSERT INTO master.master_employee (employee_id, full_name, role, department, brand_id, outlet_id, phone, telegram_id, employment_type, join_date, base_salary, status, created_at) VALUES (${id}, ${`${fn} ${ln}`}, ${role}, ${dept}, ${b.id}, ${outletId}, ${phone}, ${tg}, ${empType}, ${joinDate}, ${baseSalary}, ${status}, ${nowWib()})`;
      empId++;
    }
  }
}

async function seedAttendance() {
  console.log("Seeding attendance (30 days × 50 employees)...");
  for (let d = 0; d < 30; d++) {
      // dedupe by date+outlet+type
      const alertMap = new Map();
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    for (let empId = 1; empId <= 50; empId++) {
      const eid = `EMP-${String(empId).padStart(5, "0")}`;
      const outletIdx = (empId - 1) % 15;
      const outletId = `OL-${String(outletIdx + 1).padStart(3, "0")}`;
      const shift = randomChoice(SHIFTS);
      // 80% present, 10% late, 5% absent, 5% leave
      const r = Math.random();
      let status, lateMin = 0, isLate = false, isEarly = false;
      let checkInVal = null, checkOutVal = null;
      if (r < 0.80) {
        status = "present";
        checkInVal = `${dateStr} ${shift.start}:00`;
        checkOutVal = `${dateStr} ${shift.end}:00`;
      } else if (r < 0.90) {
        status = "present";
        isLate = true;
        lateMin = randomInt(5, 60);
        checkInVal = `${dateStr} ${shift.start}:${String(lateMin).padStart(2, "0")}:00`;
        checkOutVal = `${dateStr} ${shift.end}:00`;
      } else if (r < 0.95) {
        status = "absent";
      } else {
        status = "izin";
      }
      const aid = `ATT-${eid}-${dateStr.replace(/-/g, "")}-${randomInt(1000, 9999)}`;
      // Validate dates before insert
      if (checkInVal) checkInVal = checkInVal.replace(" ", "T");
      if (checkOutVal) checkOutVal = checkOutVal.replace(" ", "T");
      try {
        await sql.unsafe(`INSERT INTO hr.hr_attendance (attendance_id, date, employee_id, outlet_id, shift_name, check_in, check_out, is_late, late_minutes, is_early_leave, attendance_status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
          aid, dateStr, eid, outletId, shift.name, checkInVal, checkOutVal, isLate, lateMin, isEarly, status, nowWib()
        ]);
      } catch (err) {
        if (err.message.includes("Invalid time")) {
          console.log("BAD TIME:", { checkInVal, checkOutVal, status });
        } else throw err;
      }
    }
  }
}

async function seedPOSDaily() {
  console.log("Seeding POS daily (30 days × 15 outlets)...");
  for (let d = 0; d < 30; d++) {
      // dedupe by date+outlet+type
      const alertMap = new Map();
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    for (let i = 1; i <= 15; i++) {
      const outletId = `OL-${String(i).padStart(3, "0")}`;
      const brandId = BRANDS[(i - 1) % 5].id;
      const brandName = BRANDS[(i - 1) % 5].name;
      const gross = randomInt(2000000, 8000000);
      const discount = randomInt(0, 200000);
      const refund = randomInt(0, 100000);
      const voidAmt = randomInt(0, 50000);
      const net = gross - discount - refund - voidAmt;
      const txCount = randomInt(50, 200);
      const aov = Math.floor(net / txCount);
      const id = `POS-${outletId}-${dateStr.replace(/-/g, "")}-${randomInt(100, 999)}`;
      const breakdown = { cash: Math.floor(net * 0.6), qris: Math.floor(net * 0.3), transfer: Math.floor(net * 0.1) };
      await sql`INSERT INTO finance.fin_pos_daily (pos_id, date, brand_id, brand_name, outlet_id, outlet_name, gross_sales, net_sales, discount, refund, void, payment_method_breakdown, transaction_count, aov, cashier, source, recorded_at, recorded_by, created_at, updated_at) VALUES (${id}, ${dateStr}, ${brandId}, ${brandName}, ${outletId}, ${BRANDS[(i - 1) % 5].name + " " + (OUTLET_NAMES[i - 1] || "Outlet")}, ${gross}, ${net}, ${discount}, ${refund}, ${voidAmt}, ${JSON.stringify(breakdown)}, ${txCount}, ${aov}, 'Test Cashier', 'moka', ${nowWib()}, 'system', ${nowWib()}, ${nowWib()})`;
    }
  }
}

async function seedExpenses() {
  console.log("Seeding expenses (30 days × 15 outlets × 1 per day)...");
  for (let d = 0; d < 30; d++) {
      // dedupe by date+outlet+type
      const alertMap = new Map();
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    for (let i = 1; i <= 15; i++) {
      const outletId = `OL-${String(i).padStart(3, "0")}`;
      const brandId = BRANDS[(i - 1) % 5].id;
      const brandName = BRANDS[(i - 1) % 5].name;
      const outletName = BRANDS[(i - 1) % 5].name + " " + (OUTLET_NAMES[i - 1] || "Outlet");
      const catId = `EC-${String((randomInt(0, 9)) + 1).padStart(3, "0")}`;
      const amount = randomInt(50000, 2000000);
      const pmId = `PM-${String(randomInt(0, 9) + 1).padStart(3, "0")}`;
      const status = randomChoice(["PENDING", "APPROVED", "APPROVED", "APPROVED", "PAID", "PAID", "REJECTED"]);
      const id = `EXP-${outletId}-${dateStr.replace(/-/g, "")}-${randomInt(100, 999)}`;
      const desc = `Pembelian ${randomChoice(["bahan baku", "perlengkapan", "kebersihan", "transportasi"])}`;
      await sql`INSERT INTO finance.fin_expense (expense_id, date, brand_id, brand_name, outlet_id, outlet_name, category_id, description, amount, payment_method_id, approval_status, source, recorded_at, recorded_by, created_at, updated_at) VALUES (${id}, ${dateStr}, ${brandId}, ${brandName}, ${outletId}, ${outletName}, ${catId}, ${desc}, ${amount}, ${pmId}, ${status}, 'manual', ${nowWib()}, 'system', ${nowWib()}, ${nowWib()})`;
    }
  }
}

async function seedSupplierCosts() {
  console.log("Seeding supplier costs (30 days × 15 outlets × 0.5 = 225)...");
  for (let d = 0; d < 30; d++) {
      // dedupe by date+outlet+type
      const alertMap = new Map();
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    for (let i = 1; i <= 15; i++) {
      if (Math.random() > 0.5) continue;
      const outletId = `OL-${String(i).padStart(3, "0")}`;
      const brandId = BRANDS[(i - 1) % 5].id;
      const brandName = BRANDS[(i - 1) % 5].name;
      const outletName = BRANDS[(i - 1) % 5].name + " " + (OUTLET_NAMES[i - 1] || "Outlet");
      const supIdx = (d + i) % 20;
      const supId = `SUP-${String(supIdx + 1).padStart(3, "0")}`;
      const supName = SUPPLIER_NAMES[supIdx];
      const amount = randomInt(500000, 5000000);
      const paid = Math.random() > 0.3 ? amount : Math.floor(amount * 0.5);
      const unpaid = amount - paid;
      const id = `SC-${outletId}-${dateStr.replace(/-/g, "")}-${randomInt(100, 999)}`;
      const payStatus = unpaid === 0 ? "PAID" : paid === 0 ? "UNPAID" : "PARTIAL";
      await sql`INSERT INTO finance.fin_supplier_cost (cost_id, date, brand_id, brand_name, outlet_id, outlet_name, supplier_id, supplier_name, description, category, amount, paid_amount, unpaid_amount, payment_status, approval_status, due_date, source, recorded_at, recorded_by, created_at, updated_at) VALUES (${id}, ${dateStr}, ${brandId}, ${brandName}, ${outletId}, ${outletName}, ${supId}, ${supName}, 'Pembelian bulanan', 'Bahan Pokok', ${amount}, ${paid}, ${unpaid}, ${payStatus}, 'APPROVED', ${dateStr}, 'manual', ${nowWib()}, 'system', ${nowWib()}, ${nowWib()})`;
    }
  }
}

async function seedPettyCash() {
  console.log("Seeding petty cash (30 days × 15 outlets × 1 per day)...");
  for (let d = 0; d < 30; d++) {
      // dedupe by date+outlet+type
      const alertMap = new Map();
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    for (let i = 1; i <= 15; i++) {
      const outletId = `OL-${String(i).padStart(3, "0")}`;
      const brandId = BRANDS[(i - 1) % 5].id;
      const brandName = BRANDS[(i - 1) % 5].name;
      const outletName = BRANDS[(i - 1) % 5].name + " " + (OUTLET_NAMES[i - 1] || "Outlet");
      const accId = `PCA-${String(i).padStart(3, "0")}`;
      const type = randomChoice(["in", "out", "out", "in"]);
      const amount = type === "in" ? randomInt(100000, 1000000) : randomInt(20000, 500000);
      const status = randomChoice(["APPROVED", "APPROVED", "APPROVED", "PENDING"]);
      const id = `PC-${outletId}-${dateStr.replace(/-/g, "")}-${randomInt(100, 999)}`;
      const urgent = type === "OUT" && Math.random() > 0.7;
      await sql`INSERT INTO finance.fin_petty_cash (pc_id, date, brand_id, brand_name, outlet_id, outlet_name, account_id, type, amount, urgent_flag, approval_status, source, recorded_at, recorded_by, created_at, updated_at) VALUES (${id}, ${dateStr}, ${brandId}, ${brandName}, ${outletId}, ${outletName}, ${accId}, ${type}, ${amount}, ${urgent}, ${status}, 'manual', ${nowWib()}, 'system', ${nowWib()}, ${nowWib()})`;
    }
  }
}

async function seedFinanceDailySummary() {
  console.log("Seeding finance daily summary (30 days × 15 outlets)...");
  for (let d = 0; d < 30; d++) {
      // dedupe by date+outlet+type
      const alertMap = new Map();
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    for (let i = 1; i <= 15; i++) {
      const outletId = `OL-${String(i).padStart(3, "0")}`;
      const brandId = BRANDS[(i - 1) % 5].id;
      const brandName = BRANDS[(i - 1) % 5].name;
      const outletName = BRANDS[(i - 1) % 5].name + " " + (OUTLET_NAMES[i - 1] || "Outlet");
      const id = `FIN-${outletId}-${dateStr.replace(/-/g, "")}`;
      const revenue = randomInt(2000000, 8000000);
      const expense = randomInt(200000, 1500000);
      const supplierCost = randomInt(200000, 3000000);
      const pettyOut = randomInt(20000, 300000);
      const unpaid = randomInt(0, 1000000);
      const cashDiff = randomInt(-50000, 50000);
      const net = revenue - expense - supplierCost - pettyOut;
      const id2 = `FIN-SUM-${outletId}-${dateStr.replace(/-/g, "")}-${randomInt(100, 999)}`;
      await sql`INSERT INTO finance.fin_daily_summary (summary_id, date, brand, outlet, brand_id, outlet_id, revenue, expense, supplier_cost, petty_cash_out, unpaid_supplier, cash_difference, net_profit_estimate, created_at) VALUES (${id2}, ${dateStr}, ${brandName}, ${outletName}, ${brandId}, ${outletId}, ${revenue}, ${expense}, ${supplierCost}, ${pettyOut}, ${unpaid}, ${cashDiff}, ${net}, ${nowWib()}) ON CONFLICT (summary_id) DO NOTHING`;
    }
  }
}

async function seedHRDailySummary() {
  console.log("Seeding HR daily summary (30 days × 15 outlets)...");
  for (let d = 0; d < 30; d++) {
      // dedupe by date+outlet+type
      const alertMap = new Map();
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    for (let i = 1; i <= 15; i++) {
      const outletId = `OL-${String(i).padStart(3, "0")}`;
      const brandId = BRANDS[(i - 1) % 5].id;
      const brandName = BRANDS[(i - 1) % 5].name;
      const outletName = BRANDS[(i - 1) % 5].name + " " + (OUTLET_NAMES[i - 1] || "Outlet");
      const id = `HR-SUM-${outletId}-${dateStr.replace(/-/g, "")}-${randomInt(100, 999)}`;
      const totalStaff = 10;
      const present = randomInt(7, 10);
      const late = randomInt(0, 3);
      const absent = totalStaff - present;
      const issues = absent > 0 ? `${absent} staff absent` : "none";
      await sql`INSERT INTO hr.hr_daily_summary (summary_id, date, brand, outlet, brand_id, outlet_id, total_staff, staff_present, staff_late, staff_absent, payroll_issue, major_hr_issue, recommended_action, created_at) VALUES (${id}, ${dateStr}, ${brandName}, ${outletName}, ${brandId}, ${outletId}, ${totalStaff}, ${present}, ${late}, ${absent}, ${absent > 1 ? "yes" : "no"}, ${issues}, 'Review roster', ${nowWib()}) ON CONFLICT (summary_id) DO NOTHING`;
    }
  }
}

async function seedPayroll() {
  console.log("Seeding payroll (1 month × 50 employees)...");
  for (let empId = 1; empId <= 50; empId++) {
    const eid = `EMP-${String(empId).padStart(5, "0")}`;
    const baseSalary = 3500000 + randomInt(0, 30) * 100000;
    const dailyRate = Math.floor(baseSalary / 25);
    const present = randomInt(20, 25);
    const absent = 25 - present;
    const lateMin = randomInt(0, 60);
    const overtimeHrs = randomInt(0, 10);
    const attBase = dailyRate * present;
    const lateDed = Math.floor((lateMin / 60) * 50000);
    const overtimePay = Math.floor(overtimeHrs * Math.floor(dailyRate / 8) * 1.5);
    const bonus = randomInt(0, 200000);
    const gross = attBase + overtimePay + bonus;
    const tax = Math.floor(gross * 0.05);
    const net = gross - lateDed - tax;
    const id = `PAY-${eid}-202606`;
    await sql`INSERT INTO hr.hr_payroll (payroll_id, employee_id, period_start, period_end, payroll_days, attendance_count, absent_days, daily_rate, hourly_rate, regular_hourly_rate, attendance_base, attendance_deduction, late_deduction, other_deductions, overtime_hours, overtime_first_block, overtime_next_block, overtime_pay, bonus, tax_estimate_pct, gross_salary, net_salary, approved_by, approval_status, created_at, updated_at) VALUES (${id}, ${eid}, '2026-06-01', '2026-06-30', 25, ${present}, ${absent}, ${dailyRate}, ${Math.floor(dailyRate / 8)}, ${Math.floor(dailyRate / 8)}, ${attBase}, 0, ${lateDed}, 0, ${overtimeHrs}, 0, 0, ${overtimePay}, ${bonus}, 0.05, ${gross}, ${net}, 'owner', 'APPROVED', ${nowWib()}, ${nowWib()})`;
  }
}

async function seedAlerts() {
  console.log("Seeding alerts (30 days × ~3 per day)...");
  for (let d = 0; d < 30; d++) {
      // dedupe by date+outlet+type
      const alertMap = new Map();
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    for (let n = 0; n < 3; n++) {
      const outletIdx = randomInt(0, 14);
      const brandId = BRANDS[outletIdx % 5].id;
      const outletId = `OL-${String(outletIdx + 1).padStart(3, "0")}`;
      const alertTypes = ["late_staff", "cash_diff", "supplier_overdue", "petty_cash_anomaly", "high_expense", "data_missing"];
      const severities = ["warning", "warning", "critical", "warning", "critical"];
      const statuses = ["open", "ack", "ack", "resolved", "resolved"];
      const type = randomChoice(alertTypes);
      const severity = randomChoice(severities);
      const status = randomChoice(statuses);
      const messages = {
        late_staff: `${randomInt(2, 5)} staff telat lebih dari 15 menit`,
        cash_diff: "Cash difference lebih dari Rp 100.000",
        petty_cash_anomaly: "Shift lunch belum terisi, butuh supervisor coverage",
        late_staff: `Diskrepansi payroll Rp ${randomInt(50, 500) * 1000}`,
        supplier_overdue: `Tagihan supplier overdue ${randomInt(7, 30)} hari`,
        high_expense: `Pengeluaran kategori ${randomChoice(EXPENSE_CATEGORIES)} melebihi budget 20%`,
        data_missing: `Data attendance ${randomInt(1, 3)} staff belum lengkap`,
      };
      const id = `ALT-${dateStr.replace(/-/g, "")}-${outletId}-${n}`;
      await sql.unsafe(`INSERT INTO hermez.hermez_alert_log (alert_id, date, brand, outlet, source_app, alert_type, severity, message, status, assigned_to, created_at, resolved_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (date, outlet, alert_type) DO NOTHING`, [id, dateStr, BRANDS[outletIdx % 5].name, BRANDS[outletIdx % 5].name + " " + OUTLET_NAMES[outletIdx], 'hr', type, severity, messages[type], status, 'supervisor', nowWib(), status === "resolved" ? nowWib() : null]);
    }
  }
}

async function seedDailyBriefs() {
  console.log("Seeding daily briefs (30 days)...");
  for (let d = 0; d < 30; d++) {
      // dedupe by date+outlet+type
      const alertMap = new Map();
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    const id = `BRIEF-${dateStr.replace(/-/g, "")}`;
    const level = randomChoice(["green", "yellow", "yellow", "red"]);
    const totalRevenue = randomInt(30000000, 120000000);
    const totalExpense = randomInt(20000000, 80000000);
    const netProfit = totalRevenue - totalExpense;
    const lateCount = randomInt(0, 15);
    const absentCount = randomInt(0, 5);
    const alertCount = randomInt(0, 10);
    const text = `📊 Daily Brief ${dateStr}\n\n` +
      `Total Revenue: Rp ${totalRevenue.toLocaleString("id-ID")}\n` +
      `Total Expense: Rp ${totalExpense.toLocaleString("id-ID")}\n` +
      `Net Profit: Rp ${netProfit.toLocaleString("id-ID")}\n\n` +
      `Issues:\n` +
      `- ${lateCount} staff telat\n` +
      `- ${absentCount} staff absent\n` +
      `- ${alertCount} active alerts\n\n` +
      `Status: ${level}`;
    await sql`INSERT INTO hermez.hermez_daily_brief (brief_id, date, generated_at, brief_text, alert_level, sent_to_owner, sent_at) VALUES (${id}, ${dateStr}, ${nowWib()}, ${text}, ${level}, true, ${nowWib()}) ON CONFLICT (brief_id) DO NOTHING`;
  }
}

async function seedHermezConfig() {
  console.log("Seeding hermez config...");
  const configs = [
    { key: "late_staff_warning_ratio", value: "0.10" },
    { key: "late_staff_critical_ratio", value: "0.25" },
    { key: "cash_diff_warning", value: "50000" },
    { key: "cash_diff_critical", value: "200000" },
    { key: "supplier_overdue_days", value: "14" },
    { key: "high_expense_multiplier", value: "1.5" },
  ];
  for (const c of configs) {
    const id = `CFG-${c.key}`;
    await sql`INSERT INTO hermez.hermez_config (config_id, key, value, updated_at, updated_by) VALUES (${id}, ${c.key}, ${c.value}, ${nowWib()}, 'system')`;
  }
}

async function seedAuditLog() {
  console.log("Seeding audit log entries...");
  const actions = ["create", "update", "delete", "approve", "reject"];
  const entities = ["employee", "payroll", "expense", "supplier", "attendance"];
  for (let i = 0; i < 100; i++) {
    const ts = randomTimestamp(30);
    await sql`INSERT INTO finance.audit_log (actor, action, entity, entity_id, reason, created_at) VALUES (${randomChoice(PICS)}, ${randomChoice(actions)}, ${randomChoice(entities)}, ${"ENT-" + randomInt(1000, 9999)}, 'Test audit', ${ts})`;
  }
  for (let i = 0; i < 100; i++) {
    const ts = randomTimestamp(30);
    await sql`INSERT INTO hr.audit_log (actor, action, entity, entity_id, reason, created_at) VALUES (${randomChoice(PICS)}, ${randomChoice(actions)}, ${randomChoice(entities)}, ${"ENT-" + randomInt(1000, 9999)}, 'Test audit', ${ts})`;
  }
  for (let i = 0; i < 100; i++) {
    const ts = randomTimestamp(30);
    await sql`INSERT INTO master.audit_log (actor, action, entity, entity_id, reason, created_at) VALUES (${randomChoice(PICS)}, ${randomChoice(actions)}, ${randomChoice(entities)}, ${"ENT-" + randomInt(1000, 9999)}, 'Test audit', ${ts})`;
  }
  for (let i = 0; i < 50; i++) {
    const ts = randomTimestamp(30);
    await sql`INSERT INTO hermez.audit_log (actor, action, entity, entity_id, reason, created_at) VALUES (${randomChoice(PICS)}, ${randomChoice(actions)}, ${randomChoice(entities)}, ${"ENT-" + randomInt(1000, 9999)}, 'Test audit', ${ts})`;
  }
}

async function main() {
  console.log("=== MOCK DATA SEEDER ===\n");
  await clear();
  await seedBrands();
  await seedOutlets();
  await seedShifts();
  await seedPaymentMethods();
  await seedExpenseCategories();
  await seedPettyCashAccounts();
  await seedSuppliers();
  await seedHRRules();
  await seedEmployees();
  await seedAttendance();
  await seedPOSDaily();
  await seedExpenses();
  await seedSupplierCosts();
  await seedPettyCash();
  await seedFinanceDailySummary();
  await seedHRDailySummary();
  await seedPayroll();
  await seedAlerts();
  await seedDailyBriefs();
  await seedHermezConfig();
  await seedAuditLog();

  console.log("\n=== SUMMARY ===");
  const tables = await sql`SELECT
    (SELECT count(*) FROM master.master_brand) as brands,
    (SELECT count(*) FROM master.master_outlet) as outlets,
    (SELECT count(*) FROM master.master_employee) as employees,
    (SELECT count(*) FROM master.master_supplier) as suppliers,
    (SELECT count(*) FROM hr.hr_attendance) as attendance,
    (SELECT count(*) FROM finance.fin_pos_daily) as pos,
    (SELECT count(*) FROM finance.fin_expense) as expenses,
    (SELECT count(*) FROM finance.fin_supplier_cost) as supplier_costs,
    (SELECT count(*) FROM finance.fin_petty_cash) as petty_cash,
    (SELECT count(*) FROM finance.fin_daily_summary) as fin_summary,
    (SELECT count(*) FROM hr.hr_daily_summary) as hr_summary,
    (SELECT count(*) FROM hr.hr_payroll) as payroll,
    (SELECT count(*) FROM hermez.hermez_alert_log) as alerts,
    (SELECT count(*) FROM hermez.hermez_daily_brief) as briefs,
    (SELECT count(*) FROM master.fin_expense_category) as ec,
    (SELECT count(*) FROM master.fin_payment_method) as pm,
    (SELECT count(*) FROM master.fin_petty_cash_account) as pca,
    (SELECT count(*) FROM master.hr_rules) as rules,
    (SELECT count(*) FROM finance.audit_log) + (SELECT count(*) FROM hr.audit_log) + (SELECT count(*) FROM master.audit_log) + (SELECT count(*) FROM hermez.audit_log) as audit`;
  const r = tables[0];
  console.log(JSON.stringify(r, null, 2));
  await sql.end();
}

main().catch((e) => { console.error(e); sql.end(); process.exit(1); });