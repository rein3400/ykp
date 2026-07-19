/**
 * HTTP service layer. All fetch helpers return parsed `data` on success
 * or throw an Error with the API error message. Components/hooks only
 * touch this layer — never raw fetch — so error handling stays uniform.
 */

import type { CreatePosReceiptBody, PosDaily, PosReceipt } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // FormData must not carry application/json — browser sets multipart boundary.
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const res = await fetch(path, {
    ...init,
    headers: isFormData
      ? { ...(init?.headers ?? {}) }
      : {
          "content-type": "application/json",
          ...(init?.headers ?? {}),
        },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON response from ${path}`);
  }
  if (!res.ok) {
    const err = (body as { error?: { message?: string; details?: unknown } }).error;
    let msg = err?.message ?? `Request failed: ${res.status}`;
    // Surface Zod field-level details so the user sees which field failed.
    const details = err?.details;
    if (details && typeof details === "object") {
      const fieldErrors = (details as { fieldErrors?: Record<string, string[]> }).fieldErrors;
      if (fieldErrors) {
        const parts = Object.entries(fieldErrors)
          .map(([k, v]) => `${k}: ${(v ?? []).join(", ")}`)
          .filter((s) => s.trim().length > 0 && !s.endsWith(": "));
        if (parts.length) msg += ` (${parts.join("; ")})`;
      }
    }
    throw new Error(msg);
  }
  return (body as { data: T }).data;
}

export const finService = {
  // POS (daily view — kept for Task 12 cleanup)
  listPos: (params?: URLSearchParams) => request<PosDaily[]>(`/api/fin/pos${params ? `?${params}` : ""}`),
  createPos: (body: unknown) => request<unknown>("/api/fin/pos", { method: "POST", body: JSON.stringify(body) }),
  patchPos: (id: string, body: unknown) => request<unknown>(`/api/fin/pos/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  importPos: (formData: FormData) =>
    request<{ rows_imported: number; rows: { pos_id: string }[]; errors: { row: number; reason: string }[] }>("/api/fin/pos/import", {
      method: "POST",
      body: formData,
      headers: {},
    }),

  // POS receipts (individual)
  listReceipts: (params: URLSearchParams) =>
    request<PosReceipt[]>(`/api/fin/pos/receipts?${params.toString()}`),
  createReceipt: (body: CreatePosReceiptBody) =>
    request<PosReceipt>("/api/fin/pos/receipts", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getReceipt: (id: string) =>
    request<PosReceipt>(`/api/fin/pos/receipts/${id}`),
  verifyReceipt: (id: string) =>
    request<PosReceipt>(`/api/fin/pos/receipts/${id}/verify`, { method: "POST" }),
  deleteReceipt: (id: string) =>
    request<{ receipt_id: string }>(`/api/fin/pos/receipts/${id}`, { method: "DELETE" }),
  uploadPhoto: (formData: FormData) =>
    request<{ publicUrl: string; path: string }>("/api/fin/pos/upload", {
      method: "POST",
      body: formData,
      headers: {},
    }),

  // Supplier
  listSupplier: (params?: URLSearchParams) => request<unknown[]>(`/api/fin/supplier${params ? `?${params}` : ""}`),
  createSupplier: (body: unknown) => request<unknown>("/api/fin/supplier", { method: "POST", body: JSON.stringify(body) }),
  patchSupplier: (id: string, body: unknown) => request<unknown>(`/api/fin/supplier/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  approveSupplierPayment: (id: string, body: unknown) =>
    request<unknown>(`/api/fin/supplier/${id}/approve-payment`, { method: "POST", body: JSON.stringify(body) }),
  listUnpaid: () => request<(unknown & { aging_days: number })[]>("/api/fin/unpaid"),

  // Petty cash
  listPettyCash: (params?: URLSearchParams) => request<unknown[]>(`/api/fin/petty-cash${params ? `?${params}` : ""}`),
  createPettyCash: (body: unknown) => request<unknown>("/api/fin/petty-cash", { method: "POST", body: JSON.stringify(body) }),
  approvePettyCash: (id: string, body: unknown) =>
    request<unknown>(`/api/fin/petty-cash/${id}/approve`, { method: "POST", body: JSON.stringify(body) }),
  pettyCashBalance: (outletId: string, asOf: string) =>
    request<{ outlet_id: string; as_of: string; opening_balance: number; cash_in: number; cash_out: number; running_balance: number }>(
      `/api/fin/petty-cash/balance?outlet_id=${outletId}&as_of=${asOf}`,
    ),

  // Expense
  listExpense: (params?: URLSearchParams) => request<unknown[]>(`/api/fin/expense${params ? `?${params}` : ""}`),
  createExpense: (body: unknown) => request<unknown>("/api/fin/expense", { method: "POST", body: JSON.stringify(body) }),
  patchExpense: (id: string, body: unknown) => request<unknown>(`/api/fin/expense/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  approveExpense: (id: string, body: unknown) =>
    request<unknown>(`/api/fin/expense/${id}/approve`, { method: "POST", body: JSON.stringify(body) }),

  // Closing
  getClosing: (date: string, outletId: string) =>
    request<unknown>(`/api/fin/closing-cash?date=${date}&outlet_id=${outletId}`),
  createClosing: (body: unknown) => request<unknown>("/api/fin/closing-cash", { method: "POST", body: JSON.stringify(body) }),

  // Summary
  listSummary: (params?: URLSearchParams) => request<unknown[]>(`/api/fin/summary${params ? `?${params}` : ""}`),
  rebuildSummary: (body: { date: string; outlet_id?: string }) =>
    request<{ date: string; rebuilt: { outlet_id: string; ok: boolean; error?: string }[] }>("/api/fin/summary", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Analytics
  revenueAnalytics: (params: URLSearchParams) => request<unknown>(`/api/fin/analytics/revenue?${params}`),
  profitAnalytics: (params: URLSearchParams) => request<unknown>(`/api/fin/analytics/profit?${params}`),

  // Export
  exportPdf: (body: unknown) => request<{ download_url: string; filename: string }>("/api/fin/export/pdf", { method: "POST", body: JSON.stringify(body) }),
  exportCsv: (body: unknown) => request<{ download_url: string; filename: string }>("/api/fin/export/csv", { method: "POST", body: JSON.stringify(body) }),

  // Master data
  masterData: (kind: string) => request<unknown[]>(`/api/fin/master-data?kind=${kind}`),

  // Telegram test
  telegramTest: (message: string) =>
    request<{ sent: boolean; ok: boolean; message_id: number }>("/api/fin/telegram-test", { method: "POST", body: JSON.stringify({ message }) }),
};