/**
 * Shared finance feature types. Imported by components + service/queries/mutations.
 * Mirrors the fin_* table shapes returned by /api/fin/* route handlers.
 */

import type {
  FinPosDaily,
  FinSupplierCost,
  FinPettyCash,
  FinExpense,
  FinClosingCash,
  FinDailySummary,
  MasterBrand,
  MasterOutlet,
  MasterSupplier,
  FinExpenseCategory,
  FinPaymentMethod,
  FinPettyCashAccount,
} from "../../../../_packages/schema/src";

export type PosDaily = FinPosDaily;
export type SupplierCost = FinSupplierCost;
export type PettyCash = FinPettyCash;
export type Expense = FinExpense;
export type ClosingCash = FinClosingCash;
export type DailySummary = FinDailySummary;

export type Brand = MasterBrand;
export type Outlet = MasterOutlet;
export type Supplier = MasterSupplier;
export type ExpenseCategory = FinExpenseCategory;
export type PaymentMethod = FinPaymentMethod;
export type PettyCashAccount = FinPettyCashAccount;

export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
export type ApprovalStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED";

export interface CreatePosBody {
  date: string;
  outlet_id: string;
  gross_sales: number;
  discount?: number;
  refund?: number;
  void_amount?: number;
  tax?: number;
  service_charge?: number;
  payment_method?: string;
  transaction_count?: number;
  cashier?: string;
  shift?: string;
  source?: "moka" | "manual" | "import" | "receipt";
  source_ref?: string;
  notes?: string;
}

export interface CreateSupplierCostBody {
  date: string;
  outlet_id: string;
  supplier_id: string;
  description?: string;
  category?: string;
  amount: number;
  paid_amount?: number;
  due_date?: string;
  invoice_number?: string;
  bank_account?: string;
  attachment_url?: string;
  notes?: string;
}

export interface CreatePettyCashBody {
  date: string;
  outlet_id: string;
  account_id: string;
  type: "in" | "out";
  amount: number;
  category_id?: string;
  description?: string;
  attachment_url?: string;
  urgent_flag?: boolean;
}

export interface CreateExpenseBody {
  date: string;
  outlet_id: string;
  category_id: string;
  description?: string;
  amount: number;
  payment_method_id: string;
  attachment_url?: string;
  notes?: string;
}

export interface CreateClosingBody {
  date: string;
  outlet_id: string;
  physical_cash: number;
  opening_cash: number;
  pos_cash_sales: number;
  cash_revenue_in?: number;
  cash_expense_out?: number;
  petty_cash_out?: number;
  denomination_breakdown?: Record<string, number>;
}

export interface ApproveBody {
  decision: "APPROVE" | "REJECT";
  reason?: string;
}

export interface ApprovePaymentBody extends ApproveBody {
  paid_amount?: number;
}

export interface RevenueAnalytics {
  period: string;
  from: string;
  to: string;
  total: number;
  by_day: { date: string; revenue: number }[];
  by_payment: { method: string; revenue: number }[];
}

export interface ProfitAnalytics {
  period: string;
  from: string;
  to: string;
  revenue: number;
  expense: number;
  supplier_cost: number;
  petty_cash_out: number;
  net: number;
}

export interface MasterDataCache {
  brands: Brand[];
  outlets: Outlet[];
  suppliers: Supplier[];
  categories: ExpenseCategory[];
  paymentMethods: PaymentMethod[];
  pettyCashAccounts: PettyCashAccount[];
}
