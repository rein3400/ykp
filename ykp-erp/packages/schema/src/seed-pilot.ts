// ============================================================
// @ykp/schema — pilot transactional seed
// ------------------------------------------------------------
// DEV ONLY. Never enable in production. Populates 7 days of
// transactional data (HR attendance, POS aggregates, supplier
// cost, petty cash, expense, closing cash, payroll) on top of
// the master/finance/opening-balance seed so we can run an
// end-to-end smoke including Hermez alerts.
//
// Prerequisite: `npm run db:seed` already ran.
//
// Run: `npm run db:seed:pilot`
// ============================================================

import {
  createMasterDb,
  createFinanceDb,
  createHrDb,
  createHermezDb,
  initDbClients,
  getHrDb,
  getFinanceDb,
  hrSql,
  financeSql,
  hermezSql,
  masterSql,
  hrAttendance,
  hrPayroll,
  finPosDaily,
  finSupplierCost,
  finPettyCash,
  finExpense,
  finClosingCash,
} from "./index.js";
import { todayWib } from "@ykp/engine";

// ============================================================
// Static reference data (mirrors packages/schema/src/seed.ts)
// ============================================================

const OUTLETS = [
  { outletId: "OL-001", brandId: "BR-001", outletName: "Funkydak Jakarta",   shiftStart: "08:00", shiftEnd: "16:00" },
  { outletId: "OL-002", brandId: "BR-002", outletName: "Sekarpizza Bandung", shiftStart: "14:00", shiftEnd: "22:00" },
  { outletId: "OL-003", brandId: "BR-003", outletName: "Suburbuns Depok",    shiftStart: "07:00", shiftEnd: "15:00" },
] as const;

const BRANDS_BY_OUTLET: Record<string, { brandId: string; brandName: string }> = {
  "OL-001": { brandId: "BR-001", brandName: "Funkydak" },
  "OL-002": { brandId: "BR-002", brandName: "Sekarpizza" },
  "OL-003": { brandId: "BR-003", brandName: "Suburbuns" },
};

const EMPLOYEES = [
  { employeeId: "EMP-00001", fullName: "Ayu Lestari",   outletId: "OL-001", role: "Barista"    },
  { employeeId: "EMP-00002", fullName: "Budi Santoso",  outletId: "OL-001", role: "Cook"       },
  { employeeId: "EMP-00003", fullName: "Citra Wijaya",  outletId: "OL-002", role: "Supervisor" },
  { employeeId: "EMP-00004", fullName: "Dani Pratama",  outletId: "OL-002", role: "Cashier"    },
  { employeeId: "EMP-00005", fullName: "Eka Putri",     outletId: "OL-003", role: "Manager"    },
] as const;

const SUPPLIERS = [
  { supplierId: "SUP-0001", supplierName: "Ayam Berkah",     category: "Bahan Baku" },
  { supplierId: "SUP-0002", supplierName: "Tepung Sumber",   category: "Bahan Baku" },
  { supplierId: "SUP-0003", supplierName: "Packaging Jaya",  category: "Packaging"  },
] as const;

const EXPENSE_CATEGORIES = ["CAT-SEWA", "CAT-LISTRIK", "CAT-GAJI", "CAT-BAHAN", "CAT-PACK"] as const;
const PAYMENT_METHODS = ["PM-CASH", "PM-QRIS", "PM-DEBIT", "PM-TRANSFER", "PM-EWALLET"] as const;

// ============================================================
// Helpers
// ============================================================

/**
 * Build the trailing 7-day window inclusive of today (WIB). We
 * always anchor on `todayWib()` so the seed stays deterministic
 * relative to when the operator runs it — no clock-skew surprises.
 */
function last7DaysWib(): string[] {
  const today = todayWib(); // YYYY-MM-DD
  const [y, m, d] = today.split("-").map((x) => Number.parseInt(x, 10));
  const baseUtc = Date.UTC(y, m - 1, d);
  const out: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const dt = new Date(baseUtc - i * 86_400_000);
    out.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
        dt.getUTCDate(),
      ).padStart(2, "0")}`,
    );
  }
  return out;
}

/** Format `2026-07-08` -> `20260708`. */
function toCompact(d: string): string {
  return d.replace(/-/g, "");
}

/** Deterministic pseudo-random pick from a list, seeded by index. */
function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

/** Deterministic integer in [min,max] seeded by index. */
function rand(min: number, max: number, i: number): number {
  const span = max - min + 1;
  return min + ((i * 2654435761) % span);
}

/** Combine shift start `HH:mm` + late minutes into a JS Date on `dStr`. */
function checkInDate(dStr: string, shiftStart: string, lateMin: number): Date {
  const [h, m] = shiftStart.split(":").map((x) => Number.parseInt(x, 10));
  const [y, mo, da] = dStr.split("-").map((x) => Number.parseInt(x, 10));
  // Anchor in UTC to dodge host TZ, then shift into WIB (+07:00) for hour.
  const utcMs = Date.UTC(y, mo - 1, da, h - 7, m + lateMin, 0, 0);
  return new Date(utcMs);
}

function checkOutDate(dStr: string, shiftEnd: string): Date {
  const [h, m] = shiftEnd.split(":").map((x) => Number.parseInt(x, 10));
  const [y, mo, da] = dStr.split("-").map((x) => Number.parseInt(x, 10));
  const utcMs = Date.UTC(y, mo - 1, da, h - 7, m, 0, 0);
  return new Date(utcMs);
}

// ============================================================
// 1. HR attendance — 7 days x 5 employees (35 rows).
//    Distribution: PRESENT majority, some LATE (10-30 min), a few
//    ABSENT, and one LEAVE day for EMP-00003.
// ============================================================

async function seedHrAttendance() {
  console.log("[seed-pilot] hr_attendance: 7d x 5 employees");
  const days = last7DaysWib();
  const rows = [];
  let seq = 1;

  for (const d of days) {
    for (const emp of EMPLOYEES) {
      const outlet = OUTLETS.find((o) => o.outletId === emp.outletId)!;
      const idx = seq; // unique-per-row seed
      const lateBucket = idx % 7;
      const absentBucket = idx % 11;

      let status: "present" | "absent" | "izin" | "sakit" | "cuti" = "present";
      let isLate = false;
      let lateMin = 0;
      let ci: Date | null = checkInDate(d, outlet.shiftStart, 0);
      let co: Date | null = checkOutDate(d, outlet.shiftEnd);
      let notes: string | null = null;
      let shiftName: string | null = "morning";

      // EMP-00003 takes one leave day mid-week.
      if (emp.employeeId === "EMP-00003" && d === days[3]) {
        status = "cuti";
        isLate = false;
        lateMin = 0;
        ci = null;
        co = null;
        notes = "Cuti tahunan";
      } else if (absentBucket === 0 && idx !== 1) {
        status = "absent";
        isLate = false;
        lateMin = 0;
        ci = null;
        co = null;
        notes = "Tanpa kabar";
      } else if (lateBucket === 0) {
        lateMin = rand(10, 30, idx);
        isLate = true;
        ci = checkInDate(d, outlet.shiftStart, lateMin);
        notes = `Terlambat ${lateMin} menit`;
      }

      const attendanceId = `HRR-${emp.outletId}-${d}-${String(seq).padStart(3, "0")}`;
      rows.push({
        attendanceId,
        date: d,
        employeeId: emp.employeeId,
        outletId: emp.outletId,
        shiftName,
        checkIn: ci,
        checkOut: co,
        checkInLocation: status === "present" || isLate ? outlet.outletName : null,
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
    await getHrDb().insert(hrAttendance).values(r).onConflictDoNothing();
  }
  return rows.length;
}

// ============================================================
// 2. Moka POS aggregates — 7 days x 3 outlets (21 rows).
//    Gross sales 1.5M - 3.5M IDR. One day per outlet carries a
//    -150000 refund (Hari ke-3 for all three).
// ============================================================

async function seedFinPosDaily() {
  console.log("[seed-pilot] fin_pos_daily: 7d x 3 outlets");
  const days = last7DaysWib();
  const rows = [];
  let seq = 1;

  for (const d of days) {
    for (const o of OUTLETS) {
      const idx = seq;
      const grossSales = rand(1_500_000, 3_500_000, idx * 7);
      // Round to nearest 5k so numbers look human, not random.
      const gross = Math.round(grossSales / 5000) * 5000;
      const discount = Math.round(gross * 0.03); // 3% promo/discount
      const tax = Math.round(gross * 0.1); // PB1 10%
      const serviceCharge = Math.round(gross * 0.05); // 5% service
      const isRefundDay = d === days[2]; // 3rd day in window (Wed-ish)
      const refund = isRefundDay ? -150_000 : 0;
      const netSales = gross - discount + refund;
      const transactionCount = rand(40, 140, idx * 11);
      const aov = Math.round(netSales / Math.max(transactionCount, 1));
      const cashier = pick(EMPLOYEES.filter((e) => e.outletId === o.outletId), idx).fullName;
      const shift = o.outletId === "OL-002" ? "afternoon" : "morning";

      const brand = BRANDS_BY_OUTLET[o.outletId];
      const posId = `FIN-${toCompact(d)}-${o.outletId}-${String(seq).padStart(3, "0")}`;
      rows.push({
        posId,
        date: d,
        brandId: brand.brandId,
        brandName: brand.brandName,
        outletId: o.outletId,
        outletName: o.outletName,
        grossSales: gross,
        netSales,
        discount,
        refund,
        void: 0,
        tax,
        serviceCharge,
        paymentMethodBreakdown: {
          PM_CASH: Math.round(gross * 0.35),
          PM_QRIS: Math.round(gross * 0.25),
          PM_DEBIT: Math.round(gross * 0.2),
          PM_EWALLET: Math.round(gross * 0.15),
          PM_TRANSFER: Math.round(gross * 0.05),
        },
        transactionCount,
        aov,
        cashier,
        shift,
        source: "moka" as const,
        sourceRef: `MOKA-${toCompact(d)}-${o.outletId}`,
        recordedAt: new Date(`${d}T22:00:00+07:00`),
        recordedBy: "U-FIN-ADMIN",
        verifiedBy: "U-FIN-ADMIN",
        notes: isRefundDay ? "Refund salah order" : null,
      });
      seq += 1;
    }
  }

  for (const r of rows) {
    await getFinanceDb().insert(finPosDaily).values(r).onConflictDoNothing();
  }
  return rows.length;
}

// ============================================================
// 3. Supplier cost — 10 rows across 7 days, 3 suppliers.
//    Status mix: 4 PENDING, 4 APPROVED, 2 PAID.
// ============================================================

async function seedFinSupplierCost() {
  console.log("[seed-pilot] fin_supplier_cost: 10 rows");
  const days = last7DaysWib();
  // Distribute 10 rows across the 7-day window; some days get two.
  const daySlots = [0, 1, 1, 2, 3, 3, 4, 5, 5, 6];
  const supplierSlots = [0, 1, 2, 0, 1, 2, 0, 1, 2, 0];
  const amountSlots = [350_000, 1_200_000, 720_000, 480_000, 2_000_000, 950_000, 250_000, 1_650_000, 540_000, 880_000];
  // Status cycle: 4 PENDING, 4 APPROVED, 2 PAID -> 10 total.
  const statusSlots: Array<"PENDING" | "APPROVED" | "PAID"> = [
    "PENDING",
    "APPROVED",
    "PENDING",
    "APPROVED",
    "PAID",
    "PENDING",
    "APPROVED",
    "PENDING",
    "PAID",
    "APPROVED",
  ];
  const approvalSlots: Array<"DRAFT" | "PENDING" | "APPROVED" | "PAID" | "CANCELLED"> = [
    "PENDING",
    "APPROVED",
    "PENDING",
    "APPROVED",
    "PAID",
    "PENDING",
    "APPROVED",
    "PENDING",
    "PAID",
    "APPROVED",
  ];
  const rows = [];

  for (let i = 0; i < 10; i += 1) {
    const d = days[daySlots[i]];
    const sup = SUPPLIERS[supplierSlots[i]];
    const outlet = OUTLETS[i % OUTLETS.length];
    const brand = BRANDS_BY_OUTLET[outlet.outletId];
    const amount = amountSlots[i];
    const status = statusSlots[i];
    const approval = approvalSlots[i];
    const paidAmount = status === "PAID" ? amount : status === "APPROVED" ? 0 : 0;
    const unpaidAmount = amount - paidAmount;
    rows.push({
      costId: `FIN-${toCompact(d)}-SUP-${String(i + 1).padStart(3, "0")}`,
      date: d,
      brandId: brand.brandId,
      brandName: brand.brandName,
      outletId: outlet.outletId,
      outletName: outlet.outletName,
      supplierId: sup.supplierId,
      supplierName: sup.supplierName,
      description: `${sup.category} batch #${i + 1}`,
      category: sup.category,
      amount,
      paidAmount,
      unpaidAmount,
      paymentStatus: status,
      approvalStatus: approval,
      dueDate: new Date(`${days[Math.min(6, daySlots[i] + 2)]}`),
      invoiceNumber: `INV-${sup.supplierId}-${toCompact(d)}-${String(i + 1).padStart(2, "0")}`,
      bankAccount: null,
      attachmentUrl: null,
      notes: status === "PAID" ? "Sudah dibayar via transfer" : null,
      source: "manual",
      recordedAt: new Date(`${d}T10:00:00+07:00`),
      recordedBy: "U-FIN-ADMIN",
    });
  }

  for (const r of rows) {
    await getFinanceDb().insert(finSupplierCost).values(r).onConflictDoNothing();
  }
  return rows.length;
}

// ============================================================
// 4. Petty cash — 15 rows. Mix in/out, DRAFT and PENDING.
// ============================================================

async function seedFinPettyCash() {
  console.log("[seed-pilot] fin_petty_cash: 15 rows");
  const days = last7DaysWib();
  const typePattern: Array<"in" | "out"> = [
    "in",
    "out",
    "out",
    "out",
    "in",
    "out",
    "out",
    "in",
    "out",
    "out",
    "out",
    "in",
    "out",
    "out",
    "out",
  ];
  const statusPattern: Array<"DRAFT" | "PENDING" | "APPROVED"> = [
    "PENDING",
    "APPROVED",
    "PENDING",
    "DRAFT",
    "APPROVED",
    "PENDING",
    "APPROVED",
    "PENDING",
    "DRAFT",
    "APPROVED",
    "PENDING",
    "APPROVED",
    "PENDING",
    "APPROVED",
    "PENDING",
  ];
  const amounts = [200_000, 75_000, 120_000, 50_000, 500_000, 95_000, 150_000, 350_000, 60_000, 110_000, 80_000, 1_000_000, 70_000, 250_000, 90_000];
  const descriptions = [
    "Top up kas kecil",
    "Beli galon",
    "Token listrik",
    "Sabun + tissue",
    "Top up kas kecil",
    "Bensin antar barang",
    "Beli es batu",
    "Setoran kembali",
    "Kopi + gula",
    "Service printer",
    "Beli gas",
    "Top up kas kecil",
    "Parkir klien",
    "Kirim dokumen",
    "Beli bunga pot",
  ];
  const urgentIdx = new Set([5, 11]);
  const rows = [];

  for (let i = 0; i < 15; i += 1) {
    const d = days[i % days.length];
    const outlet = OUTLETS[i % OUTLETS.length];
    const brand = BRANDS_BY_OUTLET[outlet.outletId];
    rows.push({
      pcId: `PC-${toCompact(d)}-${String(i + 1).padStart(3, "0")}`,
      date: d,
      brandId: brand.brandId,
      brandName: brand.brandName,
      outletId: outlet.outletId,
      outletName: outlet.outletName,
      accountId: `PCA-${outlet.outletId}`,
      type: typePattern[i],
      amount: amounts[i],
      categoryId: EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length],
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
    await getFinanceDb().insert(finPettyCash).values(r).onConflictDoNothing();
  }
  return rows.length;
}

// ============================================================
// 5. Expenses — 15 rows. Status mix covers F6 fix targets:
//    PENDING, APPROVED, REJECTED, CANCELLED each >= 1.
// ============================================================

async function seedFinExpense() {
  console.log("[seed-pilot] fin_expense: 15 rows");
  const days = last7DaysWib();
  const statusPattern: Array<"PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "DRAFT"> = [
    "PENDING",
    "APPROVED",
    "REJECTED", // 3 — covers REJECTED branch of F6 fix
    "PENDING",
    "APPROVED",
    "CANCELLED", // 6 — covers CANCELLED branch of F6 fix
    "APPROVED",
    "PENDING",
    "APPROVED",
    "REJECTED",
    "PENDING",
    "APPROVED",
    "CANCELLED",
    "DRAFT",
    "PENDING",
  ];
  const amounts = [
    1_500_000, 450_000, 300_000, 850_000, 1_200_000, 250_000, 975_000, 600_000,
    1_800_000, 320_000, 480_000, 2_000_000, 175_000, 90_000, 720_000,
  ];
  const descriptions = [
    "Sewa tempat Juli",
    "Token listrik outlet",
    "Beli alat dapur (double bayar)",
    "Service AC",
    "Gaji helper freelance",
    "Order kemasan salah",
    "Listrik backup genset",
    "Sampah bulanan",
    "Sewa tempat Juli (lanjutan)",
    "Pembelian tanpa invoice",
    "Beli sabun + tissue",
    "Gaji shift malam",
    "Pesanan double-input",
    "Draft - belum fix",
    "Token listrik (cadangan)",
  ];
  const rows = [];

  for (let i = 0; i < 15; i += 1) {
    const d = days[i % days.length];
    const outlet = OUTLETS[i % OUTLETS.length];
    const brand = BRANDS_BY_OUTLET[outlet.outletId];
    const status = statusPattern[i];
    rows.push({
      expenseId: `EXP-${toCompact(d)}-${String(i + 1).padStart(3, "0")}`,
      date: d,
      brandId: brand.brandId,
      brandName: brand.brandName,
      outletId: outlet.outletId,
      outletName: outlet.outletName,
      categoryId: EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length],
      description: descriptions[i],
      amount: amounts[i],
      paymentMethodId: PAYMENT_METHODS[i % PAYMENT_METHODS.length],
      attachmentUrl: null,
      approvalStatus: status,
      approvedBy: status === "APPROVED" || status === "REJECTED" ? "U-FIN-ADMIN" : null,
      notes:
        status === "REJECTED"
          ? "Tidak ada lampiran / invoice"
          : status === "CANCELLED"
            ? "Double input, dibatalkan"
            : null,
      source: "manual",
      recordedAt: new Date(`${d}T13:00:00+07:00`),
      recordedBy: "U-FIN-ADMIN",
    });
  }

  for (const r of rows) {
    await getFinanceDb().insert(finExpense).values(r).onConflictDoNothing();
  }
  return rows.length;
}

// ============================================================
// 6. Closing cash — 1 row per outlet (yesterday).
// ============================================================

async function seedFinClosingCash() {
  console.log("[seed-pilot] fin_closing_cash: 3 rows (one per outlet)");
  const days = last7DaysWib();
  const closingDate = days[days.length - 2]; // yesterday
  const rows = [];

  for (let i = 0; i < OUTLETS.length; i += 1) {
    const o = OUTLETS[i];
    const opening = 2_000_000;
    const posCashSales = rand(600_000, 1_400_000, i + 3);
    const cashIn = rand(0, 200_000, i + 5);
    const cashOut = rand(100_000, 400_000, i + 7);
    const petty = rand(50_000, 150_000, i + 9);
    const expected = opening + posCashSales + cashIn - cashOut - petty;
    // One outlet has a small cash diff (-15k) to exercise Hermez cash_diff trigger.
    const physical = i === 1 ? expected - 15_000 : expected;
    const diff = physical - expected;
    rows.push({
      closingId: `CLS-${toCompact(closingDate)}-${o.outletId}`,
      date: closingDate,
      outletId: o.outletId,
      physicalCash: physical,
      openingCash: opening,
      posCashSales,
      cashRevenueIn: cashIn,
      cashExpenseOut: cashOut,
      pettyCashOut: petty,
      expectedCash: expected,
      cashDifference: diff,
      denominationBreakdown: null,
      recordedBy: "U-FIN-ADMIN",
      recordedAt: new Date(`${closingDate}T22:30:00+07:00`),
    });
  }

  for (const r of rows) {
    await getFinanceDb().insert(finClosingCash).values(r).onConflictDoNothing();
  }
  return rows.length;
}

// ============================================================
// 7. Payroll — 2 rows for current period (PENDING).
// ============================================================

async function seedHrPayroll() {
  console.log("[seed-pilot] hr_payroll: 2 rows (current period, PENDING)");
  const days = last7DaysWib();
  const periodEnd = days[days.length - 1]; // today (WIB)
  const periodStart = days[0];              // 6 days back
  const rows = [];

  // Row 1: EMP-00001 (full attendance, no late).
  rows.push({
    payrollId: `PAY-${toCompact(periodStart)}-${EMPLOYEES[0].employeeId}`,
    employeeId: EMPLOYEES[0].employeeId,
    periodStart,
    periodEnd,
    payrollDays: 7,
    attendanceCount: 7,
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
    bonus: 0,
    taxEstimatePct: "0",
    grossSalary: 4_500_000,
    netSalary: 4_500_000,
    approvedBy: null,
    approvalStatus: "PENDING" as const,
  });

  // Row 2: EMP-00003 (has a cuti day mid-week -> absentDays=1).
  rows.push({
    payrollId: `PAY-${toCompact(periodStart)}-${EMPLOYEES[2].employeeId}`,
    employeeId: EMPLOYEES[2].employeeId,
    periodStart,
    periodEnd,
    payrollDays: 7,
    attendanceCount: 6,
    absentDays: 1,
    dailyRate: Math.round(5_500_000 / 25),
    hourlyRate: Math.round(5_500_000 / 25 / 8),
    regularHourlyRate: Math.round(5_500_000 / 25 / 8),
    attendanceBase: Math.round(5_500_000 * (6 / 7)),
    attendanceDeduction: Math.round(5_500_000 * (1 / 7)),
    lateDeduction: 0,
    otherDeductions: 0,
    overtimeHours: "2.5",
    overtimeFirstBlock: 25_000,
    overtimeNextBlock: 50_000,
    overtimePay: 75_000,
    bonus: 100_000,
    taxEstimatePct: "0",
    grossSalary: Math.round(5_500_000 * (6 / 7)) + 175_000,
    netSalary: Math.round(5_500_000 * (6 / 7)) + 175_000,
    approvedBy: null,
    approvalStatus: "PENDING" as const,
  });

  for (const r of rows) {
    await getHrDb().insert(hrPayroll).values(r).onConflictDoNothing();
  }
  return rows.length;
}

// ============================================================
// Main runner
// ============================================================

async function main() {
  // Initialise the four DB clients (single source of env validation).
  // initDbClients() materialises all four singletons; the explicit
  // create*Db() calls below additionally force env-var resolution up
  // front so a missing YKP_*_DATABASE_URL fails fast before any inserts.
  initDbClients();
  createMasterDb();
  createFinanceDb();
  createHrDb();
  createHermezDb();

  // Touch getHrDb/getFinanceDb so the singletons are guaranteed live
  // for the per-entity seeders below (they grab them via getHrDb()).
  void getHrDb();
  void getFinanceDb();

  console.log("[seed-pilot] starting");
  const attendanceCount = await seedHrAttendance();
  const posCount = await seedFinPosDaily();
  const supplierCount = await seedFinSupplierCost();
  const pettyCount = await seedFinPettyCash();
  const expenseCount = await seedFinExpense();
  const closingCount = await seedFinClosingCash();
  const payrollCount = await seedHrPayroll();

  await Promise.all([
    masterSql().end(),
    hrSql().end(),
    financeSql().end(),
    hermezSql().end(),
  ]);

  console.log("\n[seed-pilot] inserted:");
  console.log(`  - hr_attendance      : ${attendanceCount} rows`);
  console.log(`  - fin_pos_daily      : ${posCount} rows`);
  console.log(`  - fin_supplier_cost  : ${supplierCount} rows`);
  console.log(`  - fin_petty_cash     : ${pettyCount} rows`);
  console.log(`  - fin_expense        : ${expenseCount} rows`);
  console.log(`  - fin_closing_cash   : ${closingCount} rows`);
  console.log(`  - hr_payroll         : ${payrollCount} rows`);
  console.log("[seed-pilot] done");
}

main().catch((err: unknown) => {
  console.error("[seed-pilot] failed:", err);
  process.exit(1);
});