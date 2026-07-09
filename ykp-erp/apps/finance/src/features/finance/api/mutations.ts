/**
 * TanStack Query mutation hooks. Each mutation invalidates the relevant
 * query keys on success so list views re-render without manual refetch.
 * Toast notifications are wired by the calling component, not here.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { finService } from './service';
import type {
  CreatePosBody,
  CreateSupplierCostBody,
  CreatePettyCashBody,
  CreateExpenseBody,
  CreateClosingBody,
  ApproveBody,
  ApprovePaymentBody,
} from './types';

function useFinMutation<TBody, TRes>(path: string[], mutFn: (b: TBody) => Promise<TRes>, invalid: string[][]) {
  const qc = useQueryClient();
  return useMutation<TRes, Error, TBody>({
    mutationFn: mutFn,
    onSuccess: () => {
      invalid.forEach((keys) => qc.invalidateQueries({ queryKey: keys }));
    },
  });
}

export function useCreatePos() {
  return useFinMutation<CreatePosBody, unknown>(
    ["fin", "pos"],
    (b) => finService.createPos(b),
    [["fin", "pos"], ["fin", "summary"], ["fin", "analytics"]],
  );
}
export function usePatchPos() {
  return useFinMutation<{ id: string; body: Partial<CreatePosBody> }, unknown>(
    ["fin", "pos"],
    ({ id, body }) => finService.patchPos(id, body),
    [["fin", "pos"], ["fin", "summary"]],
  );
}
export function useImportPos() {
  const qc = useQueryClient();
  return useMutation<{ rows_imported: number; rows: { pos_id: string }[]; errors: { row: number; reason: string }[] }, Error, FormData>({
    mutationFn: (fd) => finService.importPos(fd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin", "pos"] });
      qc.invalidateQueries({ queryKey: ["fin", "summary"] });
    },
  });
}

export function useCreateSupplier() {
  return useFinMutation<CreateSupplierCostBody, unknown>(
    ["fin", "supplier"],
    (b) => finService.createSupplier(b),
    [["fin", "supplier"], ["fin", "unpaid"], ["fin", "summary"]],
  );
}
export function usePatchSupplier() {
  return useFinMutation<{ id: string; body: Partial<CreateSupplierCostBody> }, unknown>(
    ["fin", "supplier"],
    ({ id, body }) => finService.patchSupplier(id, body),
    [["fin", "supplier"], ["fin", "unpaid"]],
  );
}
export function useApproveSupplierPayment() {
  return useFinMutation<{ id: string; body: ApprovePaymentBody }, unknown>(
    ["fin", "supplier"],
    ({ id, body }) => finService.approveSupplierPayment(id, body),
    [["fin", "supplier"], ["fin", "unpaid"], ["fin", "summary"]],
  );
}

export function useCreatePettyCash() {
  return useFinMutation<CreatePettyCashBody, unknown>(
    ["fin", "petty-cash"],
    (b) => finService.createPettyCash(b),
    [["fin", "petty-cash"], ["fin", "petty-cash-balance"], ["fin", "summary"]],
  );
}
export function useApprovePettyCash() {
  return useFinMutation<{ id: string; body: ApproveBody }, unknown>(
    ["fin", "petty-cash"],
    ({ id, body }) => finService.approvePettyCash(id, body),
    [["fin", "petty-cash"], ["fin", "petty-cash-balance"], ["fin", "summary"]],
  );
}

export function useCreateExpense() {
  return useFinMutation<CreateExpenseBody, unknown>(
    ["fin", "expense"],
    (b) => finService.createExpense(b),
    [["fin", "expense"], ["fin", "summary"]],
  );
}
export function usePatchExpense() {
  return useFinMutation<{ id: string; body: Partial<CreateExpenseBody> }, unknown>(
    ["fin", "expense"],
    ({ id, body }) => finService.patchExpense(id, body),
    [["fin", "expense"]],
  );
}
export function useApproveExpense() {
  return useFinMutation<{ id: string; body: ApproveBody }, unknown>(
    ["fin", "expense"],
    ({ id, body }) => finService.approveExpense(id, body),
    [["fin", "expense"], ["fin", "summary"]],
  );
}

export function useCreateClosing() {
  return useFinMutation<CreateClosingBody, unknown>(
    ["fin", "closing"],
    (b) => finService.createClosing(b),
    [["fin", "closing"], ["fin", "summary"]],
  );
}

export function useRebuildSummary() {
  const qc = useQueryClient();
  return useMutation<{ date: string; rebuilt: { outlet_id: string; ok: boolean; error?: string }[] }, Error, { date: string; outlet_id?: string }>({
    mutationFn: (b) => finService.rebuildSummary(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin", "summary"] });
    },
  });
}

export function useExportPdf() {
  return useMutation<{ download_url: string; filename: string }, Error, unknown>({
    mutationFn: (b) => finService.exportPdf(b),
  });
}
export function useExportCsv() {
  return useMutation<{ download_url: string; filename: string }, Error, unknown>({
    mutationFn: (b) => finService.exportCsv(b),
  });
}

export function useTelegramTest() {
  return useMutation<{ sent: boolean; ok: boolean; message_id: number }, Error, string>({
    mutationFn: (m) => finService.telegramTest(m),
  });
}