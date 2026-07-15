// ============================================================
// @ykp/schema — dev seed fixture
// ------------------------------------------------------------
// DEV ONLY. Never enable in production. Populates master, hr_rules,
// finance opening balances, and hermez config thresholds with
// minimal data to drive a smoke run.
//
// Run: `npm run db:seed`
// ============================================================

import {
  createMasterDb,
  createFinanceDb,
  createHermezDb,
  createHrDb,
  initDbClients,
  masterSql,
  financeSql,
  hermezSql,
  hrSql,
} from './db/clients';
import {
  masterBrand,
  masterOutlet,
  masterEmployee,
  masterSupplier,
  masterShift,
  hrRules,
  finExpenseCategory,
  finPaymentMethod,
  finPettyCashAccount,
  users,
} from './master';
import { finOpeningBalance, finPosDaily, finSupplierCost, finPettyCash, finExpense } from './finance';
import { hrAttendance, hrPayroll, hrPayrollLine } from './hr';
import { hermezConfig } from './hermez';

// ----- Static seed data -----

const BRANDS = [
  { brandId: "BR-001", brandName: "Funkydak", brandCode: "FD" },
  { brandId: "BR-002", brandName: "Sekarpizza", brandCode: "SP" },
  { brandId: "BR-003", brandName: "Suburbuns", brandCode: "SB" },
];

const OUTLETS = [
  { outletId: "OL-001", brandId: "BR-001", outletName: "Funkydak Jakarta", outletCode: "FD-JKT", address: "Jl. Sudirman No.1", openingTime: "08:00", closingTime: "22:00" },
  { outletId: "OL-002", brandId: "BR-002", outletName: "Sekarpizza Bandung", outletCode: "SP-BDG", address: "Jl. Braga No.2", openingTime: "10:00", closingTime: "23:00" },
  { outletId: "OL-003", brandId: "BR-003", outletName: "Suburbuns Depok", outletCode: "SB-DPK", address: "Jl. Margonda No.3", openingTime: "07:00", closingTime: "21:00" },
];

const EMPLOYEES = [
  { employeeId: "EMP-00001", fullName: "Ayu Lestari", role: "Barista", department: "FOH", brandId: "BR-001", outletId: "OL-001", baseSalary: 4_500_000 },
  { employeeId: "EMP-00002", fullName: "Budi Santoso", role: "Cook", department: "KITCHEN", brandId: "BR-001", outletId: "OL-001", baseSalary: 4_200_000 },
  { employeeId: "EMP-00003", fullName: "Citra Wijaya", role: "Supervisor", department: "FOH", brandId: "BR-002", outletId: "OL-002", baseSalary: 5_500_000 },
  { employeeId: "EMP-00004", fullName: "Dani Pratama", role: "Cashier", department: "CASHIER", brandId: "BR-002", outletId: "OL-002", baseSalary: 3_800_000 },
  { employeeId: "EMP-00005", fullName: "Eka Putri", role: "Manager", department: "GENERAL", brandId: "BR-003", outletId: "OL-003", baseSalary: 6_500_000 },
  { employeeId: "EMP-00006", fullName: "Fajar Hidayat", role: "Cook", department: "KITCHEN", brandId: "BR-001", outletId: "OL-001", baseSalary: 4_000_000 },
  { employeeId: "EMP-00007", fullName: "Gita Nuraini", role: "Waitress", department: "FOH", brandId: "BR-001", outletId: "OL-001", baseSalary: 3_500_000 },
  { employeeId: "EMP-00008", fullName: "Hendra Gunawan", role: "Barista", department: "FOH", brandId: "BR-002", outletId: "OL-002", baseSalary: 4_300_000 },
  { employeeId: "EMP-00009", fullName: "Indah Permata", role: "Cashier", department: "CASHIER", brandId: "BR-002", outletId: "OL-002", baseSalary: 3_600_000 },
  { employeeId: "EMP-00010", fullName: "Joko Susilo", role: "Supervisor", department: "FOH", brandId: "BR-001", outletId: "OL-001", baseSalary: 5_800_000 },
];

const SUPPLIERS = [
  { supplierId: "SUP-0001", supplierName: "Ayam Berkah", category: "Bahan Baku", contact: "081234567801" },
  { supplierId: "SUP-0002", supplierName: "Tepung Sumber", category: "Bahan Baku", contact: "081234567802" },
  { supplierId: "SUP-0003", supplierName: "Packaging Jaya", category: "Packaging", contact: "081234567803" },
];

const EXPENSE_CATEGORIES = [
  { categoryId: "CAT-SEWA", categoryName: "Sewa", accountType: "OPEX" as const },
  { categoryId: "CAT-LISTRIK", categoryName: "Listrik", accountType: "OPEX" as const },
  { categoryId: "CAT-GAJI", categoryName: "Gaji", accountType: "OPEX" as const },
  { categoryId: "CAT-BAHAN", categoryName: "Bahan Baku", accountType: "COGS" as const },
  { categoryId: "CAT-PACK", categoryName: "Packaging", accountType: "COGS" as const },
];

const PAYMENT_METHODS = [
  { methodId: "PM-CASH", methodName: "Cash", isCash: true },
  { methodId: "PM-QRIS", methodName: "QRIS", isCash: false },
  { methodId: "PM-DEBIT", methodName: "Debit", isCash: false },
  { methodId: "PM-TRANSFER", methodName: "Transfer", isCash: false },
  { methodId: "PM-EWALLET", methodName: "E-Wallet", isCash: false },
];

const HR_RULES = [
  { ruleId: "HRR-OL001-MORNING", outletId: "OL-001", shiftName: "morning", shiftStart: "08:00", shiftEnd: "16:00", payrollPeriodStart: 1, payrollPeriodEnd: 25 },
  { ruleId: "HRR-OL002-AFTERNOON", outletId: "OL-002", shiftName: "afternoon", shiftStart: "14:00", shiftEnd: "22:00", payrollPeriodStart: 1, payrollPeriodEnd: 25 },
  { ruleId: "HRR-OL003-MORNING", outletId: "OL-003", shiftName: "morning", shiftStart: "07:00", shiftEnd: "15:00", payrollPeriodStart: 1, payrollPeriodEnd: 25 },
];

const HERMEZ_CONFIG = [
  { configId: "HC-LS-WARN", key: "late_staff_warning_ratio", value: "0.30" },
  { configId: "HC-LS-CRIT", key: "late_staff_critical_ratio", value: "0.50" },
  { configId: "HC-CD-WARN", key: "cash_diff_warning", value: "50000" },
  { configId: "HC-CD-CRIT", key: "cash_diff_critical", value: "200000" },
  { configId: "HC-PC-MULT", key: "petty_cash_anomaly_multiplier", value: "2" },
  { configId: "HC-HE-MULT", key: "high_expense_multiplier", value: "1.2" },
];

// ----- Seeder functions -----

async function seedMaster(db: ReturnType<typeof createMasterDb>) {
  console.log("[seed] master: brands");
  for (const b of BRANDS) {
    await db.insert(masterBrand).values(b).onConflictDoNothing();
  }
  console.log("[seed] master: outlets");
  for (const o of OUTLETS) {
    await db.insert(masterOutlet).values({ ...o, timezone: "Asia/Jakarta" }).onConflictDoNothing();
  }
  console.log("[seed] master: employees");
  for (const e of EMPLOYEES) {
    await db.insert(masterEmployee).values({
      ...e,
      employmentType: "full_time",
      joinDate: new Date("2024-01-01"),
      status: "active",
    }).onConflictDoNothing();
  }
  console.log("[seed] master: suppliers");
  for (const s of SUPPLIERS) {
    await db.insert(masterSupplier).values({
      ...s,
      bankName: null,
      bankAccount: null,
      accountHolder: null,
      status: "active",
    }).onConflictDoNothing();
  }
  console.log("[seed] master: shifts");
  for (const s of [
    { shiftId: "SH-MORN", shiftName: "morning", startTime: "08:00", endTime: "16:00" },
    { shiftId: "SH-AFT", shiftName: "afternoon", startTime: "14:00", endTime: "22:00" },
    { shiftId: "SH-NIGHT", shiftName: "night", startTime: "22:00", endTime: "06:00" },
    { shiftId: "SH-FULL", shiftName: "full_day", startTime: "08:00", endTime: "20:00" },
  ]) {
    await db.insert(masterShift).values(s).onConflictDoNothing();
  }
  console.log("[seed] master: hr_rules");
  for (const r of HR_RULES) {
    await db.insert(hrRules).values(r).onConflictDoNothing();
  }
  console.log("[seed] master: fin_expense_category");
  for (const c of EXPENSE_CATEGORIES) {
    await db.insert(finExpenseCategory).values({ ...c, status: "active" }).onConflictDoNothing();
  }
  console.log("[seed] master: fin_payment_method");
  for (const m of PAYMENT_METHODS) {
    await db.insert(finPaymentMethod).values({ ...m, status: "active" }).onConflictDoNothing();
  }
  console.log("[seed] master: fin_petty_cash_account");
  for (const o of OUTLETS) {
    await db.insert(finPettyCashAccount).values({
      accountId: `PCA-${o.outletId}`,
      outletId: o.outletId,
      accountName: `Petty Cash ${o.outletName}`,
      currency: "IDR",
      status: "active",
    }).onConflictDoNothing();
  }
  console.log("[seed] master: users");
  for (const u of [
    { userId: "U-OWNER", email: "owner@ykp.local", fullName: "YKP Owner", role: "OWNER" as const },
    { userId: "U-HR-ADMIN", email: "hr@ykp.local", fullName: "HR Admin", role: "HR_ADMIN" as const },
    { userId: "U-FIN-ADMIN", email: "finance@ykp.local", fullName: "Finance Admin", role: "FINANCE_ADMIN" as const },
  ]) {
    await db.insert(users).values(u).onConflictDoNothing();
  }
}

async function seedFinanceOpening(db: ReturnType<typeof createFinanceDb>) {
  console.log("[seed] finance: fin_opening_balance");
  for (const o of OUTLETS) {
    await db.insert(finOpeningBalance).values({
      balanceId: `OB-${o.outletId}`,
      outletId: o.outletId,
      effectiveDate: new Date("2026-07-01"),
      cashBalance: 2_000_000,
      pettyCashBalance: 500_000,
      unpaidSupplierOpening: 0,
      receivableOpening: 0,
      notes: "Seed opening balance",
      recordedBy: "U-OWNER",
    }).onConflictDoNothing();
  }
}

async function seedHermezConfig(db: ReturnType<typeof createHermezDb>) {
  console.log("[seed] hermez: hermez_config");
  for (const c of HERMEZ_CONFIG) {
    await db.insert(hermezConfig).values({
      ...c,
      updatedAt: new Date(),
      updatedBy: "U-OWNER",
    }).onConflictDoNothing();
  }
}

// ----- Transactional seed helpers -----

/** Build an array of YYYY-MM-DD strings for N consecutive days starting from `startDate`. */
function dateRange(startDate: string, count: number): string[] {
  const [y, m, d] = startDate.split("-").map((x) => Number.parseInt(x, 10));
  const baseUtc = Date.UTC(y, m - 1, d);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const dt = new Date(baseUtc + i * 86_400_000);
    out.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
        dt.getUTCDate(),
      ).padStart(2, "0")}`,
    );
  }
  return out;
}

function toCompact(d: string): string {
  return d.replace(/-/g, "");
}

function ddAsDate(s: string): Date {
  return new Date(s + "T00:00:00.000Z");
}

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

function rand(min: number, max: number, i: number): number {
  const span = max - min + 1;
  return min + ((i * 2654435761) % span);
}

function checkInDate(dStr: string, shiftStart: string, lateMin: number): Date {
  const [h, m] = shiftStart.split(":").map((x) => Number.parseInt(x, 10));
  const [y, mo, da] = dStr.split("-").map((x) => Number.parseInt(x, 10));
  const utcMs = Date.UTC(y, mo - 1, da, h - 7, m + lateMin, 0, 0);
  return new Date(utcMs);
}

function checkOutDate(dStr: string, shiftEnd: string): Date {
  const [h, m] = shiftEnd.split(":").map((x) => Number.parseInt(x, 10));
  const [y, mo, da] = dStr.split("-").map((x) => Number.parseInt(x, 10));
  const utcMs = Date.UTC(y, mo - 1, da, h - 7, m, 0, 0);
  return new Date(utcMs);
}

// ----- Transactional seed data -----

const OUTLET_SHIFTS: Record<string, { shiftStart: string; shiftEnd: string; shiftName: string }> = {
  "OL-001": { shiftStart: "08:00", shiftEnd: "16:00", shiftName: "morning" },
  "OL-002": { shiftStart: "14:00", shiftEnd: "22:00", shiftName: "afternoon" },
  "OL-003": { shiftStart: "07:00", shiftEnd: "15:00", shiftName: "morning" },
};

const BRAND_BY_OUTLET: Record<string, { brandId: string; brandName: string }> = {
  "OL-001": { brandId: "BR-001", brandName: "Funkydak" },
  "OL-002": { brandId: "BR-002", brandName: "Sekarpizza" },
  "OL-003": { brandId: "BR-003", brandName: "Suburbuns" },
};

/**
 * 1. HR Attendance — 14 days x 10 employees (140 rows).
 *    Realistic patterns: mostly present, some late (5-45 min), some absent,
 *    some izin/sakit/cuti. EMP-00003 takes 2 cuti days, EMP-00007 takes 1 sakit.
 */
async function seedHrAttendance(db: ReturnType<typeof createHrDb>) {
  console.log("[seed] hr: attendance (14d x 10 employees)");
  const days = dateRange("2026-06-29", 14);
  const rows: Array<Record<string, unknown>> = [];
  let seq = 1;

  for (const d of days) {
    for (const emp of EMPLOYEES) {
      const outlet = OUTLET_SHIFTS[emp.outletId];
      if (!outlet) continue;
      const idx = seq;
      const lateBucket = idx % 7;
      const absentBucket = idx % 13;
      const sickBucket = idx % 19;
      const izinBucket = idx % 23;

      let status: "present" | "absent" | "izin" | "sakit" | "cuti" = "present";
      let isLate = false;
      let lateMin = 0;
      let ci: Date | null = checkInDate(d, outlet.shiftStart, 0);
      let co: Date | null = checkOutDate(d, outlet.shiftEnd);
      let notes: string | null = null;

      // EMP-00003: 2 cuti days (annual leave)
      if (emp.employeeId === "EMP-00003" && (d === days[5] || d === days[6])) {
        status = "cuti";
        ci = null;
        co = null;
        notes = "Cuti tahunan";
      }
      // EMP-00007: 1 sakit day
      else if (emp.employeeId === "EMP-00007" && d === days[8]) {
        status = "sakit";
        ci = null;
        co = null;
        notes = "Demam, ada surat dokter";
      }
      // EMP-00010: 1 izin day
      else if (emp.employeeId === "EMP-00010" && d === days[3]) {
        status = "izin";
        ci = null;
        co = null;
        notes = "Izin urus keluarga";
      }
      // Deterministic absent (roughly 1 per 13 rows)
      else if (absentBucket === 0 && idx > 3) {
        status = "absent";
        ci = null;
        co = null;
        notes = "Tanpa kabar";
      }
      // Deterministic late (roughly 1 per 7 rows)
      else if (lateBucket === 0) {
        lateMin = rand(5, 45, idx);
        isLate = true;
        ci = checkInDate(d, outlet.shiftStart, lateMin);
        notes = `Terlambat ${lateMin} menit`;
      }
      // Occasional sakit
      else if (sickBucket === 0 && idx > 20) {
        status = "sakit";
        ci = null;
        co = null;
        notes = "Sakit ringan";
      }
      // Occasional izin
      else if (izinBucket === 0 && idx > 40) {
        status = "izin";
        ci = null;
        co = null;
        notes = "Izin keperluan pribadi";
      }

      rows.push({
        attendanceId: `HRR-${emp.outletId}-${toCompact(d)}-${String(seq).padStart(3, "0")}`,
        date: ddAsDate(d),
        employeeId: emp.employeeId,
        outletId: emp.outletId,
        shiftName: outlet.shiftName,
        checkIn: ci,
        checkOut: co,
        checkInLocation: status === "present" || isLate ? OUTLETS.find((o) => o.outletId === emp.outletId)?.outletName ?? null : null,
        isLate,
        lateMinutes: lateMin,
        isEarlyLeave: false,
        overtimeHours: "0",
        attendanceStatus: status,
        approvedBy: status === "present" || isLate ? "U-HR-ADMIN" : null,
        notes,
      });
      seq += 1;
    }
  }

  for (const r of rows) {
    await db.insert(hrAttendance).values(r as never).onConflictDoNothing();
  }
  return rows.length;
}

/**
 * 2. POS Daily — 30 days x 2 outlets (OL-001, OL-002) = 60 rows.
 *    Realistic daily variation: 2-15 juta gross, some refund days, varied payment mix.
 */
async function seedFinPosDaily(db: ReturnType<typeof createFinanceDb>) {
  console.log("[seed] finance: pos_daily (30d x 2 outlets)");
  const days = dateRange("2026-06-13", 30);
  const posOutlets = OUTLETS.filter((o) => o.outletId === "OL-001" || o.outletId === "OL-002");
  const rows: Array<Record<string, unknown>> = [];
  let seq = 1;

  for (const d of days) {
    for (const o of posOutlets) {
      const idx = seq;
      const brand = BRAND_BY_OUTLET[o.outletId];
      // Base revenue varies by outlet: OL-001 (Funkydak) higher volume
      const baseMin = o.outletId === "OL-001" ? 4_000_000 : 2_500_000;
      const baseMax = o.outletId === "OL-001" ? 15_000_000 : 10_000_000;
      const grossSales = rand(baseMin, baseMax, idx * 13);
      const gross = Math.round(grossSales / 5000) * 5000;
      const discount = Math.round(gross * 0.03);
      const tax = Math.round(gross * 0.1);
      const serviceCharge = Math.round(gross * 0.05);
      // Weekend boost: Fri-Sat (day-of-week from 2026-06-13 = Saturday)
      const dow = (new Date(d + "T00:00:00.000Z")).getUTCDay();
      const weekendMultiplier = (dow === 5 || dow === 6) ? 1.3 : 1.0;
      const adjustedGross = Math.round(gross * weekendMultiplier / 5000) * 5000;
      // Refund on 2 random-ish days
      const isRefundDay = idx % 15 === 0;
      const refund = isRefundDay ? -rand(50_000, 200_000, idx * 7) : 0;
      const netSales = adjustedGross - discount + refund;
      const transactionCount = rand(30, 180, idx * 11);
      const aov = Math.round(netSales / Math.max(transactionCount, 1));
      const cashier = pick(EMPLOYEES.filter((e) => e.outletId === o.outletId), idx).fullName;
      const shift = o.outletId === "OL-002" ? "afternoon" : "morning";

      rows.push({
        posId: `FIN-${toCompact(d)}-${o.outletId}-${String(seq).padStart(3, "0")}`,
        date: ddAsDate(d),
        brandId: brand.brandId,
        brandName: brand.brandName,
        outletId: o.outletId,
        outletName: o.outletName,
        grossSales: adjustedGross,
        netSales,
        discount,
        refund,
        void: 0,
        tax,
        serviceCharge,
        paymentMethodBreakdown: {
          PM_CASH: Math.round(adjustedGross * 0.35),
          PM_QRIS: Math.round(adjustedGross * 0.30),
          PM_DEBIT: Math.round(adjustedGross * 0.15),
          PM_EWALLET: Math.round(adjustedGross * 0.15),
          PM_TRANSFER: Math.round(adjustedGross * 0.05),
        },
        transactionCount,
        aov,
        cashier,
        shift,
        source: "moka",
        sourceRef: `MOKA-${toCompact(d)}-${o.outletId}`,
        recordedAt: new Date(`${d}T22:00:00+07:00`),
        recordedBy: "U-FIN-ADMIN",
        verifiedBy: "U-FIN-ADMIN",
        notes: isRefundDay ? "Refund pelanggan" : null,
      });
      seq += 1;
    }
  }

  for (const r of rows) {
    await db.insert(finPosDaily).values(r as never).onConflictDoNothing();
  }
  return rows.length;
}

/**
 * 3. Supplier Cost — 10 additional invoices with varied payment statuses.
 *    Mix: PAID, UNPAID, PARTIAL, OVERDUE. Spread across 3 suppliers, 2 outlets.
 */
async function seedFinSupplierCost(db: ReturnType<typeof createFinanceDb>) {
  console.log("[seed] finance: supplier_cost (10 additional invoices)");
  const days = dateRange("2026-06-20", 20);
  const daySlots = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12];
  const supplierSlots = [0, 1, 2, 0, 1, 2, 0, 1, 2, 0];
  const amountSlots = [650_000, 1_800_000, 420_000, 2_400_000, 750_000, 1_100_000, 380_000, 2_900_000, 560_000, 1_350_000];
  const statusSlots: Array<"UNPAID" | "PARTIAL" | "PAID" | "OVERDUE"> = [
    "UNPAID", "PAID", "PARTIAL", "OVERDUE", "UNPAID",
    "PAID", "PARTIAL", "OVERDUE", "UNPAID", "PAID",
  ];
  const approvalSlots: Array<"PENDING" | "APPROVED" | "PAID"> = [
    "PENDING", "PAID", "APPROVED", "APPROVED", "PENDING",
    "PAID", "APPROVED", "APPROVED", "PENDING", "PAID",
  ];
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < 10; i += 1) {
    const d = days[daySlots[i]];
    const sup = SUPPLIERS[supplierSlots[i]];
    const outlet = OUTLETS[i % 2]; // OL-001 or OL-002
    const brand = BRAND_BY_OUTLET[outlet.outletId];
    const amount = amountSlots[i];
    const status = statusSlots[i];
    const approval = approvalSlots[i];
    const paidAmount = status === "PAID" ? amount : status === "PARTIAL" ? Math.round(amount * 0.4) : 0;
    const unpaidAmount = amount - paidAmount;
    const dueOffset = status === "OVERDUE" ? -5 : 7;
    const dueDayIdx = Math.min(days.length - 1, Math.max(0, daySlots[i] + dueOffset));

    rows.push({
      costId: `FIN-${toCompact(d)}-SUP-${String(i + 11).padStart(3, "0")}`,
      date: ddAsDate(d),
      brandId: brand.brandId,
      brandName: brand.brandName,
      outletId: outlet.outletId,
      outletName: outlet.outletName,
      supplierId: sup.supplierId,
      supplierName: sup.supplierName,
      description: `${sup.category} batch #${i + 11}`,
      category: sup.category,
      amount,
      paidAmount,
      unpaidAmount,
      paymentStatus: status,
      approvalStatus: approval,
      dueDate: ddAsDate(days[dueDayIdx]),
      invoiceNumber: `INV-${sup.supplierId}-${toCompact(d)}-${String(i + 11).padStart(2, "0")}`,
      bankAccount: null,
      attachmentUrl: null,
      notes: status === "OVERDUE" ? "Jatuh tempo, belum dibayar" : status === "PAID" ? "Lunas via transfer" : null,
      source: "manual",
      recordedAt: new Date(`${d}T10:00:00+07:00`),
      recordedBy: "U-FIN-ADMIN",
    });
  }

  for (const r of rows) {
    await db.insert(finSupplierCost).values(r as never).onConflictDoNothing();
  }
  return rows.length;
}

/**
 * 4. Expenses — 15 additional expense records across categories.
 *    Mix of APPROVED, PENDING, REJECTED, PAID statuses.
 */
async function seedFinExpense(db: ReturnType<typeof createFinanceDb>) {
  console.log("[seed] finance: expense (15 additional)");
  const days = dateRange("2026-06-15", 25);
  const statusPattern: Array<"PENDING" | "APPROVED" | "REJECTED" | "PAID" | "DRAFT"> = [
    "APPROVED", "PENDING", "PAID", "APPROVED", "REJECTED",
    "PENDING", "APPROVED", "PAID", "PENDING", "APPROVED",
    "REJECTED", "PENDING", "APPROVED", "DRAFT", "PAID",
  ];
  const amounts = [
    2_200_000, 380_000, 1_650_000, 520_000, 275_000,
    940_000, 1_100_000, 3_500_000, 430_000, 780_000,
    195_000, 1_350_000, 620_000, 85_000, 2_800_000,
  ];
  const descriptions = [
    "Sewa tempat Agustus", "Beli ATK kantor", "Perbaikan atap bocor",
    "Langganan internet", "Klaim ganda - ditolak", "Service kulkas",
    "Beli seragam baru", "Renovasi toilet", "Beli sabun cuci piring",
    "Listrik 3 bulan", "Tanpa nota - ditolak", "Gaji security",
    "Pest control", "Draft - review", "Sewa genset event",
  ];
  const catCycle = ["CAT-SEWA", "CAT-LISTRIK", "CAT-BAHAN", "CAT-PACK", "CAT-SEWA"];
  const payCycle = ["PM-TRANSFER", "PM-CASH", "PM-TRANSFER", "PM-QRIS", "PM-DEBIT"];
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < 15; i += 1) {
    const d = days[i % days.length];
    const outlet = OUTLETS[i % 2];
    const brand = BRAND_BY_OUTLET[outlet.outletId];
    const status = statusPattern[i];

    rows.push({
      expenseId: `EXP-${toCompact(d)}-${String(i + 16).padStart(3, "0")}`,
      date: ddAsDate(d),
      brandId: brand.brandId,
      brandName: brand.brandName,
      outletId: outlet.outletId,
      outletName: outlet.outletName,
      categoryId: catCycle[i % catCycle.length],
      description: descriptions[i],
      amount: amounts[i],
      paymentMethodId: payCycle[i % payCycle.length],
      attachmentUrl: null,
      approvalStatus: status,
      approvedBy: status === "APPROVED" || status === "REJECTED" || status === "PAID" ? "U-FIN-ADMIN" : null,
      notes: status === "REJECTED" ? "Dokumen tidak lengkap" : status === "PAID" ? "Sudah dibayar" : null,
      source: "manual",
      recordedAt: new Date(`${d}T13:00:00+07:00`),
      recordedBy: "U-FIN-ADMIN",
    });
  }

  for (const r of rows) {
    await db.insert(finExpense).values(r as never).onConflictDoNothing();
  }
  return rows.length;
}

/**
 * 5. Petty Cash — 15 additional transactions (mix in/out).
 */
async function seedFinPettyCash(db: ReturnType<typeof createFinanceDb>) {
  console.log("[seed] finance: petty_cash (15 additional)");
  const days = dateRange("2026-06-18", 22);
  const typePattern: Array<"in" | "out"> = [
    "out", "out", "in", "out", "out",
    "in", "out", "out", "in", "out",
    "out", "in", "out", "out", "in",
  ];
  const statusPattern: Array<"DRAFT" | "PENDING" | "APPROVED"> = [
    "APPROVED", "PENDING", "APPROVED", "PENDING", "APPROVED",
    "APPROVED", "PENDING", "DRAFT", "APPROVED", "PENDING",
    "APPROVED", "APPROVED", "PENDING", "APPROVED", "APPROVED",
  ];
  const amounts = [85_000, 45_000, 300_000, 120_000, 65_000, 500_000, 95_000, 40_000, 250_000, 110_000, 75_000, 400_000, 55_000, 180_000, 600_000];
  const descriptions = [
    "Beli tisu + sabun", "Parkir harian", "Top up kas kecil",
    "Bensin motor operasional", "Beli air mineral", "Setoran kas kecil",
    "Beli gas elpiji", "Fotokopi dokumen", "Top up kas kecil",
    "Service AC portable", "Beli plastik sampah", "Top up kas kecil",
    "Ongkir paket", "Beli alat tulis", "Setoran kas kecil",
  ];
  const urgentIdx = new Set([3, 9, 13]);
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < 15; i += 1) {
    const d = days[i % days.length];
    const outlet = OUTLETS[i % 2];
    const brand = BRAND_BY_OUTLET[outlet.outletId];

    rows.push({
      pcId: `PC-${toCompact(d)}-${String(i + 16).padStart(3, "0")}`,
      date: ddAsDate(d),
      brandId: brand.brandId,
      brandName: brand.brandName,
      outletId: outlet.outletId,
      outletName: outlet.outletName,
      accountId: `PCA-${outlet.outletId}`,
      type: typePattern[i],
      amount: amounts[i],
      categoryId: EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length].categoryId,
      description: descriptions[i],
      attachmentUrl: null,
      urgentFlag: urgentIdx.has(i),
      approvalStatus: statusPattern[i],
      approvedBy: statusPattern[i] === "APPROVED" ? "U-FIN-ADMIN" : null,
      source: "manual",
      recordedAt: new Date(`${d}T11:00:00+07:00`),
      recordedBy: "U-FIN-ADMIN",
    });
  }

  for (const r of rows) {
    await db.insert(finPettyCash).values(r as never).onConflictDoNothing();
  }
  return rows.length;
}

/**
 * 6. Payroll — 1 payroll period for 5 employees with bonus + penalty examples.
 *    Period: 2026-06-26 to 2026-07-10 (15 days).
 *    EMP-00001: full attendance + bonus
 *    EMP-00002: some late days, late deduction
 *    EMP-00003: cuti days, attendance deduction
 *    EMP-00006: overtime + bonus
 *    EMP-00009: absent days, penalty
 */
async function seedHrPayroll(db: ReturnType<typeof createHrDb>) {
  console.log("[seed] hr: payroll (5 employees, 1 period)");
  const periodStart = "2026-06-26";
  const periodEnd = "2026-07-10";
  const payrollDays = 15;
  const rows: Array<Record<string, unknown>> = [];
  const lines: Array<Record<string, unknown>> = [];

  // EMP-00001: Ayu Lestari — full attendance, no issues, bonus 300k
  const p1Id = `PAY-${toCompact(periodStart)}-EMP-00001`;
  rows.push({
    payrollId: p1Id,
    employeeId: "EMP-00001",
    periodStart: ddAsDate(periodStart),
    periodEnd: ddAsDate(periodEnd),
    payrollDays,
    attendanceCount: 15,
    absentDays: 0,
    dailyRate: Math.round(4_500_000 / 25),
    hourlyRate: Math.round(4_500_000 / 25 / 8),
    regularHourlyRate: Math.round(4_500_000 / 25 / 8),
    attendanceBase: 4_500_000,
    attendanceDeduction: 0,
    lateDeduction: 0,
    otherDeductions: 0,
    overtimeHours: "0",
    overtimeFirstBlock: 0,
    overtimeNextBlock: 0,
    overtimePay: 0,
    bonus: 300_000,
    taxEstimatePct: "0",
    grossSalary: 4_800_000,
    netSalary: 4_800_000,
    approvedBy: "U-HR-ADMIN",
    approvalStatus: "APPROVED",
  });
  lines.push({ lineId: `${p1Id}-L01`, payrollId: p1Id, label: "Bonus kinerja", amount: 300_000, sign: "plus" });

  // EMP-00002: Budi Santoso — 3 late days, late deduction 75k
  const p2Id = `PAY-${toCompact(periodStart)}-EMP-00002`;
  rows.push({
    payrollId: p2Id,
    employeeId: "EMP-00002",
    periodStart: ddAsDate(periodStart),
    periodEnd: ddAsDate(periodEnd),
    payrollDays,
    attendanceCount: 15,
    absentDays: 0,
    dailyRate: Math.round(4_200_000 / 25),
    hourlyRate: Math.round(4_200_000 / 25 / 8),
    regularHourlyRate: Math.round(4_200_000 / 25 / 8),
    attendanceBase: 4_200_000,
    attendanceDeduction: 0,
    lateDeduction: 75_000,
    otherDeductions: 0,
    overtimeHours: "0",
    overtimeFirstBlock: 0,
    overtimeNextBlock: 0,
    overtimePay: 0,
    bonus: 0,
    taxEstimatePct: "0",
    grossSalary: 4_200_000,
    netSalary: 4_125_000,
    approvedBy: "U-HR-ADMIN",
    approvalStatus: "APPROVED",
  });
  lines.push({ lineId: `${p2Id}-L01`, payrollId: p2Id, label: "Denda keterlambatan (3x)", amount: 75_000, sign: "minus" });

  // EMP-00003: Citra Wijaya — 2 cuti days, attendance deduction
  const p3Id = `PAY-${toCompact(periodStart)}-EMP-00003`;
  const emp3Base = 5_500_000;
  const emp3Deduction = Math.round(emp3Base * (2 / 25));
  rows.push({
    payrollId: p3Id,
    employeeId: "EMP-00003",
    periodStart: ddAsDate(periodStart),
    periodEnd: ddAsDate(periodEnd),
    payrollDays,
    attendanceCount: 13,
    absentDays: 2,
    dailyRate: Math.round(emp3Base / 25),
    hourlyRate: Math.round(emp3Base / 25 / 8),
    regularHourlyRate: Math.round(emp3Base / 25 / 8),
    attendanceBase: emp3Base - emp3Deduction,
    attendanceDeduction: emp3Deduction,
    lateDeduction: 0,
    otherDeductions: 0,
    overtimeHours: "0",
    overtimeFirstBlock: 0,
    overtimeNextBlock: 0,
    overtimePay: 0,
    bonus: 0,
    taxEstimatePct: "0",
    grossSalary: emp3Base - emp3Deduction,
    netSalary: emp3Base - emp3Deduction,
    approvedBy: "U-HR-ADMIN",
    approvalStatus: "APPROVED",
  });
  lines.push({ lineId: `${p3Id}-L01`, payrollId: p3Id, label: "Potongan cuti (2 hari)", amount: emp3Deduction, sign: "minus" });

  // EMP-00006: Fajar Hidayat — overtime 4h + bonus 200k
  const p4Id = `PAY-${toCompact(periodStart)}-EMP-00006`;
  const emp6OvertimePay = 120_000;
  rows.push({
    payrollId: p4Id,
    employeeId: "EMP-00006",
    periodStart: ddAsDate(periodStart),
    periodEnd: ddAsDate(periodEnd),
    payrollDays,
    attendanceCount: 15,
    absentDays: 0,
    dailyRate: Math.round(4_000_000 / 25),
    hourlyRate: Math.round(4_000_000 / 25 / 8),
    regularHourlyRate: Math.round(4_000_000 / 25 / 8),
    attendanceBase: 4_000_000,
    attendanceDeduction: 0,
    lateDeduction: 0,
    otherDeductions: 0,
    overtimeHours: "4.0",
    overtimeFirstBlock: 40_000,
    overtimeNextBlock: 80_000,
    overtimePay: emp6OvertimePay,
    bonus: 200_000,
    taxEstimatePct: "0",
    grossSalary: 4_000_000 + emp6OvertimePay + 200_000,
    netSalary: 4_000_000 + emp6OvertimePay + 200_000,
    approvedBy: "U-HR-ADMIN",
    approvalStatus: "APPROVED",
  });
  lines.push({ lineId: `${p4Id}-L01`, payrollId: p4Id, label: "Lembur 4 jam", amount: emp6OvertimePay, sign: "plus" });
  lines.push({ lineId: `${p4Id}-L02`, payrollId: p4Id, label: "Bonus event", amount: 200_000, sign: "plus" });

  // EMP-00009: Indah Permata — 2 absent days, penalty 100k
  const p5Id = `PAY-${toCompact(periodStart)}-EMP-00009`;
  const emp9Base = 3_600_000;
  const emp9AbsentDeduction = Math.round(emp9Base * (2 / 25));
  rows.push({
    payrollId: p5Id,
    employeeId: "EMP-00009",
    periodStart: ddAsDate(periodStart),
    periodEnd: ddAsDate(periodEnd),
    payrollDays,
    attendanceCount: 13,
    absentDays: 2,
    dailyRate: Math.round(emp9Base / 25),
    hourlyRate: Math.round(emp9Base / 25 / 8),
    regularHourlyRate: Math.round(emp9Base / 25 / 8),
    attendanceBase: emp9Base - emp9AbsentDeduction,
    attendanceDeduction: emp9AbsentDeduction,
    lateDeduction: 0,
    otherDeductions: 100_000,
    overtimeHours: "0",
    overtimeFirstBlock: 0,
    overtimeNextBlock: 0,
    overtimePay: 0,
    bonus: 0,
    taxEstimatePct: "0",
    grossSalary: emp9Base - emp9AbsentDeduction,
    netSalary: emp9Base - emp9AbsentDeduction - 100_000,
    approvedBy: "U-HR-ADMIN",
    approvalStatus: "APPROVED",
  });
  lines.push({ lineId: `${p5Id}-L01`, payrollId: p5Id, label: "Potongan absen (2 hari)", amount: emp9AbsentDeduction, sign: "minus" });
  lines.push({ lineId: `${p5Id}-L02`, payrollId: p5Id, label: "Denda pelanggaran", amount: 100_000, sign: "minus" });

  for (const r of rows) {
    await db.insert(hrPayroll).values(r as never).onConflictDoNothing();
  }
  for (const l of lines) {
    await db.insert(hrPayrollLine).values(l as never).onConflictDoNothing();
  }
  return rows.length;
}

/**
 * 7. Leave Requests — 3 leave examples via attendance records.
 *    - EMP-00005: approved annual leave (cuti) 2 days
 *    - EMP-00008: pending sick leave (sakit) 1 day
 *    - EMP-00004: approved permission (izin) 1 day
 */
async function seedHrLeaveRequests(db: ReturnType<typeof createHrDb>) {
  console.log("[seed] hr: leave requests (3 examples)");
  const rows: Array<Record<string, unknown>> = [];

  // EMP-00005 (Eka Putri, OL-003): approved annual leave 2026-07-11, 2026-07-12
  rows.push({
    attendanceId: "HRR-OL-003-20260711-LEA",
    date: ddAsDate("2026-07-11"),
    employeeId: "EMP-00005",
    outletId: "OL-003",
    shiftName: "morning",
    checkIn: null,
    checkOut: null,
    checkInLocation: null,
    isLate: false,
    lateMinutes: 0,
    isEarlyLeave: false,
    overtimeHours: "0",
    attendanceStatus: "cuti",
    approvedBy: "U-HR-ADMIN",
    notes: "Cuti tahunan - disetujui",
  });
  rows.push({
    attendanceId: "HRR-OL-003-20260712-LEA",
    date: ddAsDate("2026-07-12"),
    employeeId: "EMP-00005",
    outletId: "OL-003",
    shiftName: "morning",
    checkIn: null,
    checkOut: null,
    checkInLocation: null,
    isLate: false,
    lateMinutes: 0,
    isEarlyLeave: false,
    overtimeHours: "0",
    attendanceStatus: "cuti",
    approvedBy: "U-HR-ADMIN",
    notes: "Cuti tahunan - disetujui",
  });

  // EMP-00008 (Hendra Gunawan, OL-002): pending sick leave 2026-07-11
  rows.push({
    attendanceId: "HRR-OL-002-20260711-SCK",
    date: ddAsDate("2026-07-11"),
    employeeId: "EMP-00008",
    outletId: "OL-002",
    shiftName: "afternoon",
    checkIn: null,
    checkOut: null,
    checkInLocation: null,
    isLate: false,
    lateMinutes: 0,
    isEarlyLeave: false,
    overtimeHours: "0",
    attendanceStatus: "sakit",
    approvedBy: null,
    notes: "Sakit - menunggu persetujuan (surat dokter menyusul)",
  });

  // EMP-00004 (Dani Pratama, OL-002): approved permission 2026-07-10
  rows.push({
    attendanceId: "HRR-OL-002-20260710-IZN",
    date: ddAsDate("2026-07-10"),
    employeeId: "EMP-00004",
    outletId: "OL-002",
    shiftName: "afternoon",
    checkIn: null,
    checkOut: null,
    checkInLocation: null,
    isLate: false,
    lateMinutes: 0,
    isEarlyLeave: false,
    overtimeHours: "0",
    attendanceStatus: "izin",
    approvedBy: "U-HR-ADMIN",
    notes: "Izin urus dokumen - disetujui",
  });

  for (const r of rows) {
    await db.insert(hrAttendance).values(r as never).onConflictDoNothing();
  }
  return rows.length;
}

// ----- Main runner -----

async function main() {
  initDbClients();
  console.log("[seed] starting");
  await seedMaster(createMasterDb());
  await seedFinanceOpening(createFinanceDb());
  await seedHermezConfig(createHermezDb());

  // Transactional seed data (idempotent, dev-only)
  await seedHrAttendance(createHrDb());
  await seedFinPosDaily(createFinanceDb());
  await seedFinSupplierCost(createFinanceDb());
  await seedFinExpense(createFinanceDb());
  await seedFinPettyCash(createFinanceDb());
  await seedHrPayroll(createHrDb());
  await seedHrLeaveRequests(createHrDb());

  await Promise.all([masterSql().end(), financeSql().end(), hermezSql().end(), hrSql().end()]);
  console.log("[seed] done");
}

main().catch((err: unknown) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});