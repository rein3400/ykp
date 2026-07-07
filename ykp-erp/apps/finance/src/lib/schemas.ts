/**
 * Zod schemas for inbound API payloads. Single source of truth — every
 * route handler imports the relevant schema and parses with `.safeParse`,
 * returning 400 on failure so the client gets a structured error envelope.
 *
 * Field names mirror the `fin_*` table column names from @ykp/schema so
 * the mapped Drizzle insert reads straight from `parsed.data`.
 */
import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const positiveInt = z.number().int().nonnegative();

// ----- POS ---------------------------------------------------------------
export const FinPosQuerySchema = z.object({
  date: dateString.optional(),
  date_from: dateString.optional(),
  date_to: dateString.optional(),
  outlet_id: z.string().optional(),
  brand_id: z.string().optional(),
  payment_method: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional().default(100),
});

export const FinPosCreateSchema = z.object({
  date: dateString,
  outlet_id: z.string().min(1, "outlet_id required"),
  gross_sales: positiveInt,
  discount: positiveInt.default(0),
  refund: positiveInt.default(0),
  void_amount: positiveInt.default(0),
  tax: positiveInt.default(0),
  service_charge: positiveInt.default(0),
  payment_method: z.string().default("Cash"),
  payment_method_ids: z.array(z.string().min(1)).optional(),
  transaction_count: z.number().int().positive().default(1),
  cashier: z.string().optional(),
  shift: z.string().optional(),
  source: z.enum(["moka", "manual", "import", "receipt"]).default("manual"),
  source_ref: z.string().optional(),
  notes: z.string().optional(),
});

export const FinPosPatchSchema = FinPosCreateSchema.partial().extend({
  verified_by: z.string().optional(),
});

// ----- Supplier costing --------------------------------------------------
export const FinSupplierQuerySchema = z.object({
  date_from: dateString.optional(),
  date_to: dateString.optional(),
  supplier_id: z.string().optional(),
  status: z.enum(["UNPAID", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  outlet_id: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional().default(100),
});

export const FinSupplierCreateSchema = z
  .object({
    date: dateString,
    outlet_id: z.string().min(1),
    supplier_id: z.string().min(1),
    description: z.string().optional(),
    category: z.string().optional(),
    amount: positiveInt,
    paid_amount: positiveInt.default(0),
    due_date: dateString.optional(),
    invoice_number: z.string().optional(),
    bank_account: z.string().optional(),
    attachment_url: z.string().url().optional(),
    notes: z.string().optional(),
    source: z.string().optional(),
  })
  .refine((v) => v.paid_amount <= v.amount, {
    message: "paid_amount must not exceed amount",
    path: ["paid_amount"],
  });

export const FinSupplierPatchSchema = z.object({
  paid_amount: positiveInt.optional(),
  notes: z.string().optional(),
  attachment_url: z.string().url().optional(),
  due_date: dateString.optional(),
});

export const FinSupplierApprovePaymentSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  paid_amount: positiveInt.optional(),
  reason: z.string().optional(),
});

// ----- Petty cash --------------------------------------------------------
export const FinPettyCashQuerySchema = z.object({
  date_from: dateString.optional(),
  date_to: dateString.optional(),
  outlet_id: z.string().optional(),
  account_id: z.string().optional(),
  type: z.enum(["in", "out"]).optional(),
  urgent_only: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(500).optional().default(100),
});

export const FinPettyCashCreateSchema = z.object({
  date: dateString,
  outlet_id: z.string().min(1),
  account_id: z.string().min(1),
  type: z.enum(["in", "out"]),
  amount: positiveInt,
  category_id: z.string().optional(),
  description: z.string().optional(),
  attachment_url: z.string().url().optional(),
  urgent_flag: z.boolean().default(false),
});

export const FinPettyCashApproveSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().optional(),
});

export const FinPettyCashBalanceQuerySchema = z.object({
  outlet_id: z.string().min(1),
  as_of: dateString,
});

// ----- Expense -----------------------------------------------------------
export const FinExpenseQuerySchema = z.object({
  date_from: dateString.optional(),
  date_to: dateString.optional(),
  category_id: z.string().optional(),
  outlet_id: z.string().optional(),
  approval_status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED", "PAID", "CANCELLED"]).optional(),
  limit: z.coerce.number().int().positive().max(500).optional().default(100),
});

export const FinExpenseCreateSchema = z.object({
  date: dateString,
  outlet_id: z.string().min(1),
  category_id: z.string().min(1),
  description: z.string().optional(),
  amount: positiveInt,
  payment_method_id: z.string().min(1),
  attachment_url: z.string().url().optional(),
  notes: z.string().optional(),
});

export const FinExpensePatchSchema = z.object({
  description: z.string().optional(),
  amount: positiveInt.optional(),
  attachment_url: z.string().url().optional(),
  notes: z.string().optional(),
});

export const FinExpenseApproveSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "PAID"]),
  reason: z.string().optional(),
});

// ----- Closing cash ------------------------------------------------------
export const FinClosingQuerySchema = z.object({
  date: dateString,
  outlet_id: z.string().min(1),
});

export const FinClosingCreateSchema = z.object({
  date: dateString,
  outlet_id: z.string().min(1),
  physical_cash: positiveInt,
  opening_cash: positiveInt,
  pos_cash_sales: positiveInt,
  cash_revenue_in: positiveInt.default(0),
  cash_expense_out: positiveInt.default(0),
  petty_cash_out: positiveInt.default(0),
  denomination_breakdown: z.record(z.string(), z.number().int().nonnegative()).optional(),
});

// ----- Summary -----------------------------------------------------------
export const FinSummaryQuerySchema = z.object({
  date_from: dateString.optional(),
  date_to: dateString.optional(),
  outlet: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional().default(60),
});

export const FinSummaryRebuildSchema = z.object({
  date: dateString,
  outlet_id: z.string().optional(),
});

// ----- Analytics ---------------------------------------------------------
export const FinAnalyticsPeriodSchema = z.object({
  period: z.enum(["day", "week", "month", "quarter", "year"]).default("month"),
  date_from: dateString.optional(),
  date_to: dateString.optional(),
  brand_id: z.string().optional(),
  outlet_id: z.string().optional(),
});

// ----- Export ------------------------------------------------------------
export const FinExportRequestSchema = z.object({
  report: z.enum([
    "pos_daily",
    "supplier_cost",
    "petty_cash",
    "expense",
    "closing_cash",
    "summary",
    "profit",
  ]),
  date_from: dateString,
  date_to: dateString,
  filters: z
    .object({
      outlet_id: z.string().optional(),
      brand_id: z.string().optional(),
      supplier_id: z.string().optional(),
      status: z.string().optional(),
    })
    .optional()
    .default({}),
});

// ----- Master data readers (read-only on master DB) ----------------------
export const FinMasterQuerySchema = z.object({
  kind: z.enum([
    "brands",
    "outlets",
    "suppliers",
    "categories",
    "payment_methods",
    "petty_cash_accounts",
  ]),
});
