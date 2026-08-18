import {
  pgSchema,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  bigserial,
  unique,
} from "drizzle-orm/pg-core";
import { finPettyCashAccount, finExpenseCategory, finPaymentMethod } from './master';

const finance = pgSchema("finance");

// ============================================================
// Enums
// ============================================================

export const posSourceEnum = finance.enum("pos_source", [
  "moka",
  "manual",
  "import",
  "receipt",
]);

export const paymentStatusEnum = finance.enum("payment_status", [
  "UNPAID",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);

export const pettyCashTypeEnum = finance.enum("petty_cash_type", ["in", "out"]);

export const financeApprovalStatusEnum = finance.enum("finance_approval_status", [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PAID",
  "CANCELLED",
]);

// ============================================================
// fin_pos_daily
// UNIQUE (date, outlet_id)
// ============================================================

export const finPosDaily = finance.table(
  "fin_pos_daily",
  {
    posId: text("pos_id").primaryKey(),
    date: date("date", { mode: "date" }).notNull(),
    brandId: text("brand_id").notNull(),
    brandName: text("brand_name").notNull(),
    outletId: text("outlet_id").notNull(),
    outletName: text("outlet_name").notNull(),
    grossSales: integer("gross_sales").notNull().default(0),
    netSales: integer("net_sales").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    refund: integer("refund").notNull().default(0),
    void: integer("void").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    serviceCharge: integer("service_charge").notNull().default(0),
    paymentMethodBreakdown: jsonb("payment_method_breakdown").notNull().default({}),
    transactionCount: integer("transaction_count").notNull().default(0),
    aov: integer("aov").notNull().default(0),
    cashier: text("cashier"),
    shift: text("shift"),
    source: posSourceEnum("source").notNull(),
    sourceRef: text("source_ref"),
    recordedAt: timestamp("recorded_at", { mode: "date" }).defaultNow().notNull(),
    recordedBy: text("recorded_by"),
    verifiedBy: text("verified_by"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    dateOutletUnique: unique("fin_pos_daily_date_outlet_unique").on(t.date, t.outletId),
  }),
);

// ============================================================
// fin_supplier_cost
// ============================================================

export const finSupplierCost = finance.table("fin_supplier_cost", {
  costId: text("cost_id").primaryKey(),
  date: date("date", { mode: "date" }).notNull(),
  brandId: text("brand_id").notNull(),
  brandName: text("brand_name").notNull(),
  outletId: text("outlet_id").notNull(),
  outletName: text("outlet_name").notNull(),
  // Cross-DB ref to master.master_supplier — no PG FK, app resolves.
  supplierId: text("supplier_id").notNull(),
  supplierName: text("supplier_name").notNull(),
  description: text("description"),
  category: text("category"),
  amount: integer("amount").notNull().default(0),
  paidAmount: integer("paid_amount").notNull().default(0),
  unpaidAmount: integer("unpaid_amount").notNull().default(0),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("UNPAID"),
  // Defect F4 fix: explicit approval FSM column. Supplier POST defaults to
  // PENDING so the approve-payment flow can transition DRAFT->PENDING or
  // PENDING->APPROVED/REJECTED. Approve-payment rejects from PAID/CANCELLED.
  approvalStatus: financeApprovalStatusEnum("approval_status").notNull().default("PENDING"),
  dueDate: date("due_date", { mode: "date" }),
  invoiceNumber: text("invoice_number"),
  bankAccount: text("bank_account"),
  attachmentUrl: text("attachment_url"),
  notes: text("notes"),
  source: text("source"),
  recordedAt: timestamp("recorded_at", { mode: "date" }).defaultNow().notNull(),
  recordedBy: text("recorded_by"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// fin_petty_cash (FK -> fin_petty_cash_account in master DB)
// Since master + finance are separate databases, the account_id
// relationship is application-resolved (400 on missing account).
// ============================================================

export const finPettyCash = finance.table("fin_petty_cash", {
  pcId: text("pc_id").primaryKey(),
  date: date("date", { mode: "date" }).notNull(),
  brandId: text("brand_id").notNull(),
  brandName: text("brand_name").notNull(),
  outletId: text("outlet_id").notNull(),
  outletName: text("outlet_name").notNull(),
  accountId: text("account_id").notNull(),
  type: pettyCashTypeEnum("type").notNull(),
  amount: integer("amount").notNull().default(0),
  // Cross-DB ref to master.fin_expense_category — app resolves.
  categoryId: text("category_id"),
  description: text("description"),
  attachmentUrl: text("attachment_url"),
  urgentFlag: boolean("urgent_flag").notNull().default(false),
  approvalStatus: financeApprovalStatusEnum("approval_status").notNull().default("DRAFT"),
  approvedBy: text("approved_by"),
  source: text("source"),
  recordedAt: timestamp("recorded_at", { mode: "date" }).defaultNow().notNull(),
  recordedBy: text("recorded_by"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// fin_expense (FK -> fin_expense_category + fin_payment_method in master DB)
// Same-DB references here would point to master tables in a different DB,
// so FKs are omitted; app layer resolves and rejects on mismatch (400).
// ============================================================

export const finExpense = finance.table("fin_expense", {
  expenseId: text("expense_id").primaryKey(),
  date: date("date", { mode: "date" }).notNull(),
  brandId: text("brand_id").notNull(),
  brandName: text("brand_name").notNull(),
  outletId: text("outlet_id").notNull(),
  outletName: text("outlet_name").notNull(),
  categoryId: text("category_id").notNull(),
  description: text("description"),
  amount: integer("amount").notNull().default(0),
  paymentMethodId: text("payment_method_id").notNull(),
  attachmentUrl: text("attachment_url"),
  approvalStatus: financeApprovalStatusEnum("approval_status").notNull().default("DRAFT"),
  approvedBy: text("approved_by"),
  notes: text("notes"),
  source: text("source"),
  recordedAt: timestamp("recorded_at", { mode: "date" }).defaultNow().notNull(),
  recordedBy: text("recorded_by"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// fin_opening_balance
// ============================================================

export const finOpeningBalance = finance.table("fin_opening_balance", {
  balanceId: text("balance_id").primaryKey(),
  outletId: text("outlet_id").notNull(),
  effectiveDate: date("effective_date", { mode: "date" }).notNull(),
  cashBalance: integer("cash_balance").notNull().default(0),
  pettyCashBalance: integer("petty_cash_balance").notNull().default(0),
  unpaidSupplierOpening: integer("unpaid_supplier_opening").notNull().default(0),
  receivableOpening: integer("receivable_opening").notNull().default(0),
  notes: text("notes"),
  recordedBy: text("recorded_by"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// fin_closing_cash
// ============================================================

export const finClosingCash = finance.table("fin_closing_cash", {
  closingId: text("closing_id").primaryKey(),
  date: date("date", { mode: "date" }).notNull(),
  outletId: text("outlet_id").notNull(),
  physicalCash: integer("physical_cash").notNull().default(0),
  openingCash: integer("opening_cash").notNull().default(0),
  posCashSales: integer("pos_cash_sales").notNull().default(0),
  cashRevenueIn: integer("cash_revenue_in").notNull().default(0),
  cashExpenseOut: integer("cash_expense_out").notNull().default(0),
  pettyCashOut: integer("petty_cash_out").notNull().default(0),
  expectedCash: integer("expected_cash").notNull().default(0),
  cashDifference: integer("cash_difference").notNull().default(0),
  denominationBreakdown: jsonb("denomination_breakdown"),
  recordedBy: text("recorded_by"),
  recordedAt: timestamp("recorded_at", { mode: "date" }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// fin_daily_summary
// UNIQUE (date, outlet)
// ============================================================

export const finDailySummary = finance.table(
  "fin_daily_summary",
  {
    summaryId: text("summary_id").primaryKey(),
    date: date("date", { mode: "date" }).notNull(),
    brand: text("brand").notNull(),
    outlet: text("outlet").notNull(),
    // Defect H2/Z1 fix: store brand_id + outlet_id so downstream filters and
    // Hermez validation resolve by ID, not by (locale-dependent) name. No FK.
    brandId: text("brand_id"),
    outletId: text("outlet_id"),
    revenue: integer("revenue").notNull().default(0),
    expense: integer("expense").notNull().default(0),
    supplierCost: integer("supplier_cost").notNull().default(0),
    pettyCashOut: integer("petty_cash_out").notNull().default(0),
    unpaidSupplier: integer("unpaid_supplier").notNull().default(0),
    cashDifference: integer("cash_difference").notNull().default(0),
    netProfitEstimate: integer("net_profit_estimate").notNull().default(0),
    majorFinanceIssue: text("major_finance_issue").notNull().default("none"),
    recommendedAction: text("recommended_action"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    dateOutletUnique: unique("fin_daily_summary_date_outlet_unique").on(t.date, t.outlet),
  }),
);

// ============================================================
// Inferred types
// ============================================================

export type FinPosDaily = typeof finPosDaily.$inferSelect;
export type NewFinPosDaily = typeof finPosDaily.$inferInsert;
export type FinSupplierCost = typeof finSupplierCost.$inferSelect;
export type NewFinSupplierCost = typeof finSupplierCost.$inferInsert;
export type FinPettyCash = typeof finPettyCash.$inferSelect;
export type NewFinPettyCash = typeof finPettyCash.$inferInsert;
export type FinExpense = typeof finExpense.$inferSelect;
export type NewFinExpense = typeof finExpense.$inferInsert;
export type FinOpeningBalance = typeof finOpeningBalance.$inferSelect;
export type NewFinOpeningBalance = typeof finOpeningBalance.$inferInsert;
export type FinClosingCash = typeof finClosingCash.$inferSelect;
export type NewFinClosingCash = typeof finClosingCash.$inferInsert;
export type FinDailySummary = typeof finDailySummary.$inferSelect;
export type NewFinDailySummary = typeof finDailySummary.$inferInsert;

// ============================================================
// finance_audit_log — per-domain audit trail for finance approval
// transitions (expense, petty cash, supplier cost, payroll PAID).
// ============================================================

export const financeAuditLog = finance.table("audit_log", {
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

export type FinanceAuditLog = typeof financeAuditLog.$inferSelect;
export type NewFinanceAuditLog = typeof financeAuditLog.$inferInsert;