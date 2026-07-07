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
  initDbClients,
  masterSql,
  financeSql,
  hermezSql,
} from "./db/clients.js";
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
} from "./master.js";
import { finOpeningBalance } from "./finance.js";
import { hermezConfig } from "./hermez.js";

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

// ----- Main runner -----

async function main() {
  initDbClients();
  console.log("[seed] starting");
  await seedMaster(createMasterDb());
  await seedFinanceOpening(createFinanceDb());
  await seedHermezConfig(createHermezDb());
  await Promise.all([masterSql().end(), financeSql().end(), hermezSql().end()]);
  console.log("[seed] done");
}

main().catch((err: unknown) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});