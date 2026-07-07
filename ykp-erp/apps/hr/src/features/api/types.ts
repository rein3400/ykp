/**
 * Shared types for the HR app. Mirrors the @ykp/schema row types plus
 * server-enriched display fields.
 */

export type AttendanceStatus = "present" | "absent" | "izin" | "sakit" | "cuti";
export type ApprovalStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export interface AttendanceRow {
  attendanceId: string;
  date: string;
  employeeId: string;
  outletId: string;
  shiftName: string | null;
  checkIn: string | Date | null;
  checkOut: string | Date | null;
  isLate: boolean;
  lateMinutes: number;
  isEarlyLeave: boolean;
  overtimeHours: string | number;
  attendanceStatus: AttendanceStatus;
  notes?: string | null;
  // server-enriched
  outletName?: string | null;
  employeeName?: string | null;
}

export interface PayrollRow {
  payrollId: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  payrollDays: number;
  attendanceCount: number;
  absentDays: number;
  grossSalary: number;
  netSalary: number;
  approvalStatus: ApprovalStatus;
  // server-enriched
  employeeName?: string | null;
}

export interface HrRuleRow {
  ruleId: string;
  outletId: string;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  lateToleranceMinutes: number;
  overtimeRateMultiplier: string;
  overtimeDailyCapHours: string;
  mandatoryCheckout: boolean;
  payrollPeriodStart: number;
  payrollPeriodEnd: number;
}

export interface EmployeeRow {
  employeeId: string;
  fullName: string;
  role: string | null;
  department: string | null;
  brandId: string | null;
  outletId: string | null;
  phone: string | null;
  employmentType: string | null;
  baseSalary: number;
  status: string;
}

export interface HrDailySummaryRow {
  summaryId: string;
  date: string;
  brand: string;
  outlet: string;
  totalStaff: number;
  staffPresent: number;
  staffLate: number;
  staffAbsent: number;
  payrollIssue: string;
  majorHrIssue: string;
  recommendedAction: string | null;
}