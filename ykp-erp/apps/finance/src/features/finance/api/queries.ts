/**
 * TanStack Query queryOptions + hooks for finance resources.
 * One hook per resource; each returns typed data from finService.
 * Mutation invalidation lives in mutations.ts.
 */
import { useQuery } from "@tanstack/react-query";
import { finService } from './service';
import type {
  PosDaily,
  PosReceipt,
  SupplierCost,
  PettyCash,
  Expense,
  ClosingCash,
  DailySummary,
  Brand,
  Outlet,
  Supplier,
  ExpenseCategory,
  PaymentMethod,
  PettyCashAccount,
  RevenueAnalytics,
  ProfitAnalytics,
} from './types';

const STALE = 30_000;

// ----- Master data -----
export function useBrands() {
  return useQuery<Brand[]>({
    queryKey: ["fin", "brands"],
    queryFn: () => finService.masterData("brands") as Promise<Brand[]>,
    staleTime: STALE * 60,
  });
}
export function useOutlets() {
  return useQuery<Outlet[]>({
    queryKey: ["fin", "outlets"],
    queryFn: () => finService.masterData("outlets") as Promise<Outlet[]>,
    staleTime: STALE * 60,
  });
}
export function useSuppliers() {
  return useQuery<Supplier[]>({
    queryKey: ["fin", "suppliers"],
    queryFn: () => finService.masterData("suppliers") as Promise<Supplier[]>,
    staleTime: STALE * 60,
  });
}
export function useExpenseCategories() {
  return useQuery<ExpenseCategory[]>({
    queryKey: ["fin", "categories"],
    queryFn: () => finService.masterData("categories") as Promise<ExpenseCategory[]>,
    staleTime: STALE * 60,
  });
}
export function usePaymentMethods() {
  return useQuery<PaymentMethod[]>({
    queryKey: ["fin", "payment-methods"],
    queryFn: () => finService.masterData("payment_methods") as Promise<PaymentMethod[]>,
    staleTime: STALE * 60,
  });
}
export function usePettyCashAccounts() {
  return useQuery<PettyCashAccount[]>({
    queryKey: ["fin", "petty-cash-accounts"],
    queryFn: () => finService.masterData("petty_cash_accounts") as Promise<PettyCashAccount[]>,
    staleTime: STALE * 60,
  });
}

// ----- POS -----
export function usePosList(params: URLSearchParams) {
  return useQuery<PosDaily[]>({
    queryKey: ["fin", "pos", params.toString()],
    queryFn: () => finService.listPos(params) as Promise<PosDaily[]>,
    staleTime: STALE,
  });
}

export function usePosReceipts(params: URLSearchParams) {
  return useQuery<PosReceipt[]>({
    queryKey: ["fin", "pos-receipts", params.toString()],
    queryFn: () => finService.listReceipts(params),
    staleTime: STALE,
  });
}

// ----- Supplier -----
export function useSupplierList(params: URLSearchParams) {
  return useQuery<SupplierCost[]>({
    queryKey: ["fin", "supplier", params.toString()],
    queryFn: () => finService.listSupplier(params) as Promise<SupplierCost[]>,
    staleTime: STALE,
  });
}
export function useUnpaidList() {
  return useQuery<(SupplierCost & { aging_days: number })[]>({
    queryKey: ["fin", "unpaid"],
    queryFn: () => finService.listUnpaid() as Promise<(SupplierCost & { aging_days: number })[]>,
    staleTime: STALE,
  });
}

// ----- Petty cash -----
export function usePettyCashList(params: URLSearchParams) {
  return useQuery<PettyCash[]>({
    queryKey: ["fin", "petty-cash", params.toString()],
    queryFn: () => finService.listPettyCash(params) as Promise<PettyCash[]>,
    staleTime: STALE,
  });
}
export function usePettyCashBalance(outletId: string | undefined, asOf: string) {
  return useQuery<{ outlet_id: string; as_of: string; opening_balance: number; cash_in: number; cash_out: number; running_balance: number }>({
    queryKey: ["fin", "petty-cash-balance", outletId, asOf],
    queryFn: () => finService.pettyCashBalance(outletId!, asOf),
    enabled: Boolean(outletId),
    staleTime: STALE,
  });
}

// ----- Expense -----
export function useExpenseList(params: URLSearchParams) {
  return useQuery<Expense[]>({
    queryKey: ["fin", "expense", params.toString()],
    queryFn: () => finService.listExpense(params) as Promise<Expense[]>,
    staleTime: STALE,
  });
}

// ----- Closing -----
export function useClosing(date: string | undefined, outletId: string | undefined) {
  return useQuery<ClosingCash | null>({
    queryKey: ["fin", "closing", date, outletId],
    queryFn: () => finService.getClosing(date!, outletId!) as Promise<ClosingCash | null>,
    enabled: Boolean(date && outletId),
    staleTime: STALE,
  });
}

// ----- Summary -----
export function useSummaryList(params: URLSearchParams) {
  return useQuery<DailySummary[]>({
    queryKey: ["fin", "summary", params.toString()],
    queryFn: () => finService.listSummary(params) as Promise<DailySummary[]>,
    staleTime: STALE,
  });
}

// ----- Analytics -----
export function useRevenueAnalytics(params: URLSearchParams) {
  return useQuery<RevenueAnalytics>({
    queryKey: ["fin", "analytics", "revenue", params.toString()],
    queryFn: () => finService.revenueAnalytics(params) as Promise<RevenueAnalytics>,
    staleTime: STALE,
  });
}
export function useProfitAnalytics(params: URLSearchParams) {
  return useQuery<ProfitAnalytics>({
    queryKey: ["fin", "analytics", "profit", params.toString()],
    queryFn: () => finService.profitAnalytics(params) as Promise<ProfitAnalytics>,
    staleTime: STALE,
  });
}