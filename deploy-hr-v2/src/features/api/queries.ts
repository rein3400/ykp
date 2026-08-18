import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type {
  AttendanceRow,
  PayrollRow,
  HrRuleRow,
  EmployeeRow,
  HrDailySummaryRow,
} from "./types";

/**
 * Thin fetch wrapper. Every HR API response is either { data } or { error },
 * so the helper unwraps the data field.
 */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as
    | { data: T }
    | { error: { message: string } }
    | null;
  if (!body) throw new Error("Empty response");
  if ("error" in body) throw new Error(body.error.message);
  return body.data;
}

// ----- query keys (single source of truth) ----------------------------------

export const hrKeys = {
  all: ["hr"] as const,
  attendance: (params: { date?: string; outletId?: string; employeeId?: string }) =>
    ["hr", "attendance", params] as const,
  payroll: (params: { employeeId?: string; periodStart?: string; periodEnd?: string }) =>
    ["hr", "payroll", params] as const,
  rules: (outletId?: string) => ["hr", "rules", outletId ?? "all"] as const,
  employees: (outletId?: string) => ["hr", "employees", outletId ?? "all"] as const,
  summary: (params: { date?: string; outletId?: string }) =>
    ["hr", "summary", params] as const,
};

// ----- queries --------------------------------------------------------------

export function useAttendance(
  params: { date?: string; outletId?: string; employeeId?: string },
  options?: Partial<UseQueryOptions<{ attendance: AttendanceRow[] }>>,
) {
  const qs = new URLSearchParams();
  if (params.date) qs.set("date", params.date);
  if (params.outletId) qs.set("outletId", params.outletId);
  if (params.employeeId) qs.set("employeeId", params.employeeId);
  const path = `/api/hr/attendance${qs.toString() ? `?${qs.toString()}` : ""}`;
  return useQuery({
    queryKey: hrKeys.attendance(params),
    queryFn: () => apiFetch<{ attendance: AttendanceRow[] }>(path),
    ...options,
  });
}

export function usePayroll(
  params: { employeeId?: string; periodStart?: string; periodEnd?: string },
  options?: Partial<UseQueryOptions<{ payroll: PayrollRow[] }>>,
) {
  const qs = new URLSearchParams();
  if (params.employeeId) qs.set("employeeId", params.employeeId);
  if (params.periodStart) qs.set("periodStart", params.periodStart);
  if (params.periodEnd) qs.set("periodEnd", params.periodEnd);
  const path = `/api/hr/payroll${qs.toString() ? `?${qs.toString()}` : ""}`;
  return useQuery({
    queryKey: hrKeys.payroll(params),
    queryFn: () => apiFetch<{ payroll: PayrollRow[] }>(path),
    ...options,
  });
}

export function useHrRules(outletId?: string) {
  const qs = outletId ? `?outletId=${encodeURIComponent(outletId)}` : "";
  return useQuery({
    queryKey: hrKeys.rules(outletId),
    queryFn: () => apiFetch<{ rules: HrRuleRow[] }>(`/api/hr/rules${qs}`),
  });
}

export function useEmployees(outletId?: string) {
  const qs = outletId ? `?outletId=${encodeURIComponent(outletId)}` : "";
  return useQuery({
    queryKey: hrKeys.employees(outletId),
    queryFn: () => apiFetch<{ employees: EmployeeRow[] }>(`/api/hr/employees${qs}`),
  });
}

export function useHrSummary(params: { date?: string; outletId?: string }) {
  const qs = new URLSearchParams();
  if (params.date) qs.set("date", params.date);
  if (params.outletId) qs.set("outletId", params.outletId);
  const path = `/api/hr/summary${qs.toString() ? `?${qs.toString()}` : ""}`;
  return useQuery({
    queryKey: hrKeys.summary(params),
    queryFn: () => apiFetch<{ summaries: HrDailySummaryRow[] }>(path),
  });
}

// ----- mutations ------------------------------------------------------------

export function useCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { employeeId: string; outletId: string; shiftName?: string; location?: string }) =>
      apiFetch<{
        attendanceId: string;
        checkIn: string;
        isLate: boolean;
        lateMinutes: number;
      }>("/api/hr/attendance", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrKeys.attendance({}) });
    },
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { attendanceId: string; location?: string }) =>
      apiFetch<{
        attendanceId: string;
        checkOut: string;
        isEarlyLeave: boolean;
        overtimeHours: number;
      }>("/api/hr/attendance", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrKeys.attendance({}) });
    },
  });
}

export function useRunPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { periodStart: string; periodEnd: string; outletId?: string }) =>
      apiFetch<{ payrollIds: string[]; count: number }>("/api/hr/payroll", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr", "payroll"] });
      void qc.invalidateQueries({ queryKey: ["hr", "summary"] });
    },
  });
}

export function useApprovePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { id: string; decision: "APPROVE" | "REJECT" | "SUBMIT" | "PAY"; reason?: string }) =>
      apiFetch<{ payrollId: string; approvalStatus: string }>(
        `/api/hr/payroll/${encodeURIComponent(body.id)}/approve`,
        {
          method: "POST",
          body: JSON.stringify({ decision: body.decision, reason: body.reason }),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr", "payroll"] });
    },
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<HrRuleRow>) =>
      apiFetch<{ ruleId: string }>("/api/hr/rules", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr", "rules"] });
    },
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { id: string; patch: Partial<HrRuleRow> }) =>
      apiFetch<{ ruleId: string; updated: Partial<HrRuleRow> }>(
        `/api/hr/rules/${encodeURIComponent(body.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(body.patch),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr", "rules"] });
    },
  });
}

export function useRebuildSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { date: string; outletId?: string }) =>
      apiFetch<{ rebuilt: number }>("/api/hr/summary", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr", "summary"] });
    },
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<EmployeeRow>) =>
      apiFetch<{ employeeId: string }>("/api/hr/employees", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr", "employees"] });
    },
  });
}

export function usePatchAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { id: string; attendanceStatus?: string; approvedBy?: string; notes?: string }) =>
      apiFetch<{ attendanceId: string; updated: unknown }>(
        `/api/hr/attendance/${encodeURIComponent(body.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr", "attendance"] });
    },
  });
}