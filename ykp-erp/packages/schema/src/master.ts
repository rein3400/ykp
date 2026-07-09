import {
  pgSchema,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  date,
  jsonb,
  bigserial,
} from "drizzle-orm/pg-core";

const master = pgSchema("master");

// ============================================================
// Enums (fixed value sets — drizzle maps to Postgres enum types)
// ============================================================

export const userRoleEnum = master.enum("user_role", [
  "OWNER",
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "HR_ADMIN",
  "BRAND_MANAGER",
  "OUTLET_MANAGER",
  "STAFF_INPUT",
  "VIEWER",
]);

export const expenseAccountTypeEnum = master.enum("expense_account_type", [
  "OPEX",
  "CAPEX",
  "COGS",
  "OTHER",
]);

// ============================================================
// master_brand
// ============================================================

export const masterBrand = master.table("master_brand", {
  brandId: text("brand_id").primaryKey(),
  brandName: text("brand_name").notNull(),
  brandCode: text("brand_code").notNull().unique(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// master_outlet (FK -> master_brand, same DB)
// ============================================================

export const masterOutlet = master.table(
  "master_outlet",
  {
    outletId: text("outlet_id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => masterBrand.brandId, { onDelete: "restrict" }),
    outletName: text("outlet_name").notNull(),
    outletCode: text("outlet_code").notNull().unique(),
    address: text("address"),
    openingTime: text("opening_time"),
    closingTime: text("closing_time"),
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    picOutlet: text("pic_outlet"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
);

// ============================================================
// master_employee (cross-DB referenced by hr schema; no FK here)
// ============================================================

export const masterEmployee = master.table("master_employee", {
  employeeId: text("employee_id").primaryKey(),
  fullName: text("full_name").notNull(),
  role: text("role"),
  department: text("department"),
  // brandId/outletId — cross-DB refs to master_brand/master_outlet.
  // Postgres cannot enforce FK across databases; app layer validates
  // existence before insert and returns 400 on mismatch.
  brandId: text("brand_id"),
  outletId: text("outlet_id"),
  phone: text("phone"),
  telegramId: text("telegram_id"),
  employmentType: text("employment_type"),
  joinDate: date("join_date", { mode: "date" }),
  baseSalary: integer("base_salary").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// master_supplier (cross-DB referenced by finance; no FK here)
// ============================================================

export const masterSupplier = master.table("master_supplier", {
  supplierId: text("supplier_id").primaryKey(),
  supplierName: text("supplier_name").notNull(),
  category: text("category"),
  contact: text("contact"),
  bankName: text("bank_name"),
  bankAccount: text("bank_account"),
  accountHolder: text("account_holder"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// master_shift
// ============================================================

export const masterShift = master.table("master_shift", {
  shiftId: text("shift_id").primaryKey(),
  shiftName: text("shift_name").notNull().unique(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// hr_rules (FK -> master_outlet, same DB)
// ============================================================

export const hrRules = master.table("hr_rules", {
  ruleId: text("rule_id").primaryKey(),
  outletId: text("outlet_id")
    .notNull()
    .references(() => masterOutlet.outletId, { onDelete: "cascade" }),
  shiftName: text("shift_name").notNull(),
  shiftStart: text("shift_start").notNull(),
  shiftEnd: text("shift_end").notNull(),
  lateToleranceMinutes: integer("late_tolerance_minutes").notNull().default(15),
  overtimeRateMultiplier: numeric("overtime_rate_multiplier", { precision: 5, scale: 2 })
    .notNull()
    .default("1.5"),
  overtimeDailyCapHours: numeric("overtime_daily_cap_hours", { precision: 4, scale: 2 })
    .notNull()
    .default("4"),
  // Defect H2 fix: explicit first-block cap (default 1h) so payroll routes
  // can split lembur without casting.
  firstBlockHours: integer("first_block_hours").notNull().default(1),
  earlyClockinToleranceMin: integer("early_clockin_tolerance_min").notNull().default(30),
  mandatoryCheckout: boolean("mandatory_checkout").notNull().default(true),
  payrollPeriodStart: integer("payroll_period_start").notNull(),
  payrollPeriodEnd: integer("payroll_period_end").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// fin_expense_category
// ============================================================

export const finExpenseCategory = master.table("fin_expense_category", {
  categoryId: text("category_id").primaryKey(),
  categoryName: text("category_name").notNull(),
  accountType: expenseAccountTypeEnum("account_type").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// fin_payment_method
// ============================================================

export const finPaymentMethod = master.table("fin_payment_method", {
  methodId: text("method_id").primaryKey(),
  methodName: text("method_name").notNull(),
  isCash: boolean("is_cash").notNull().default(false),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// fin_petty_cash_account (FK -> master_outlet, same DB)
// ============================================================

export const finPettyCashAccount = master.table("fin_petty_cash_account", {
  accountId: text("account_id").primaryKey(),
  outletId: text("outlet_id")
    .notNull()
    .references(() => masterOutlet.outletId, { onDelete: "restrict" }),
  accountName: text("account_name").notNull(),
  currency: text("currency").notNull().default("IDR"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// users (auth + RBAC; cross-DB refs are application-resolved)
// ============================================================

export const users = master.table("users", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: userRoleEnum("role").notNull(),
  // outletId may reference master_outlet across DBs — app layer validates.
  outletId: text("outlet_id"),
  telegramId: text("telegram_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// Inferred types
// ============================================================

export type MasterBrand = typeof masterBrand.$inferSelect;
export type NewMasterBrand = typeof masterBrand.$inferInsert;
export type MasterOutlet = typeof masterOutlet.$inferSelect;
export type NewMasterOutlet = typeof masterOutlet.$inferInsert;
export type MasterEmployee = typeof masterEmployee.$inferSelect;
export type NewMasterEmployee = typeof masterEmployee.$inferInsert;
export type MasterSupplier = typeof masterSupplier.$inferSelect;
export type NewMasterSupplier = typeof masterSupplier.$inferInsert;
export type MasterShift = typeof masterShift.$inferSelect;
export type NewMasterShift = typeof masterShift.$inferInsert;
export type HrRules = typeof hrRules.$inferSelect;
export type NewHrRules = typeof hrRules.$inferInsert;
export type FinExpenseCategory = typeof finExpenseCategory.$inferSelect;
export type NewFinExpenseCategory = typeof finExpenseCategory.$inferInsert;
export type FinPaymentMethod = typeof finPaymentMethod.$inferSelect;
export type NewFinPaymentMethod = typeof finPaymentMethod.$inferInsert;
export type FinPettyCashAccount = typeof finPettyCashAccount.$inferSelect;
export type NewFinPettyCashAccount = typeof finPettyCashAccount.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ============================================================
// master_audit_log — same DDL as the other domain audit_log tables.
// Lives in the master DB so master-side admin actions (brand/outlet
// CRUD, user role changes, etc.) are captured alongside business rows.
// ============================================================

export const masterAuditLog = master.table("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export type MasterAuditLog = typeof masterAuditLog.$inferSelect;
export type NewMasterAuditLog = typeof masterAuditLog.$inferInsert;