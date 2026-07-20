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
  uniqueIndex,
  unique,
  index,
} from "drizzle-orm/pg-core";

const hr = pgSchema("hr");

// ============================================================
// Enums
// ============================================================

export const attendanceStatusEnum = hr.enum("attendance_status", [
  "present",
  "absent",
  "izin",
  "sakit",
  "cuti",
]);

export const approvalStatusEnum = hr.enum("approval_status", [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PAID",
  "CANCELLED",
]);

export const payrollLineSignEnum = hr.enum("payroll_line_sign", ["plus", "minus"]);

// ============================================================
// hr_attendance
// employeeId references master_employee across DBs (no PG FK — app resolves).
// ============================================================

export const hrAttendance = hr.table(
  "hr_attendance",
  {
    attendanceId: text("attendance_id").primaryKey(),
    date: date("date", { mode: "date" }).notNull(),
    // Cross-DB ref to master.master_employee — Postgres cannot enforce FK
    // across databases; app layer validates employee_id existence before
    // insert and returns 400 on mismatch.
    employeeId: text("employee_id").notNull(),
    outletId: text("outlet_id").notNull(),
    shiftName: text("shift_name"),
    checkIn: timestamp("check_in", { mode: "date" }),
    checkOut: timestamp("check_out", { mode: "date" }),
    checkInLocation: text("check_in_location"),
    isLate: boolean("is_late").notNull().default(false),
    lateMinutes: integer("late_minutes").notNull().default(0),
    isEarlyLeave: boolean("is_early_leave").notNull().default(false),
    overtimeHours: numeric("overtime_hours", { precision: 5, scale: 2 }).notNull().default("0"),
    attendanceStatus: attendanceStatusEnum("attendance_status").notNull(),
    approvedBy: text("approved_by"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    dateEmployeeIdx: uniqueIndex("hr_attendance_date_employee_idx").on(t.date, t.employeeId),
    dateOutletIdx: index("hr_attendance_date_outlet_idx").on(t.date, t.outletId),
  }),
);

// ============================================================
// hr_payroll
// employeeId references master_employee across DBs (no PG FK — app resolves).
// ============================================================

export const hrPayroll = hr.table("hr_payroll", {
  payrollId: text("payroll_id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  periodStart: date("period_start", { mode: "date" }).notNull(),
  periodEnd: date("period_end", { mode: "date" }).notNull(),
  payrollDays: integer("payroll_days").notNull(),
  attendanceCount: integer("attendance_count").notNull().default(0),
  absentDays: integer("absent_days").notNull().default(0),
  dailyRate: integer("daily_rate").notNull().default(0),
  hourlyRate: integer("hourly_rate").notNull().default(0),
  regularHourlyRate: integer("regular_hourly_rate").notNull().default(0),
  attendanceBase: integer("attendance_base").notNull().default(0),
  attendanceDeduction: integer("attendance_deduction").notNull().default(0),
  lateDeduction: integer("late_deduction").notNull().default(0),
  otherDeductions: integer("other_deductions").notNull().default(0),
  overtimeHours: numeric("overtime_hours", { precision: 6, scale: 2 }).notNull().default("0"),
  overtimeFirstBlock: integer("overtime_first_block").notNull().default(0),
  overtimeNextBlock: integer("overtime_next_block").notNull().default(0),
  overtimePay: integer("overtime_pay").notNull().default(0),
  bonus: integer("bonus").notNull().default(0),
  taxEstimatePct: numeric("tax_estimate_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  grossSalary: integer("gross_salary").notNull().default(0),
  netSalary: integer("net_salary").notNull().default(0),
  approvedBy: text("approved_by"),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// hr_payroll_line (FK -> hr_payroll, same DB)
// ============================================================

export const hrPayrollLine = hr.table("hr_payroll_line", {
  lineId: text("line_id").primaryKey(),
  payrollId: text("payroll_id")
    .notNull()
    .references(() => hrPayroll.payrollId, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amount: integer("amount").notNull().default(0),
  sign: payrollLineSignEnum("sign").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// hr_daily_summary
// UNIQUE (date, outlet)
// ============================================================

export const hrDailySummary = hr.table(
  "hr_daily_summary",
  {
    summaryId: text("summary_id").primaryKey(),
    date: date("date", { mode: "date" }).notNull(),
    brand: text("brand").notNull(),
    outlet: text("outlet").notNull(),
    // Defect H2/Z1 fix: store brand_id + outlet_id so downstream filters and
    // Hermez validation resolve by ID, not by (locale-dependent) name. No FK
    // (cross-DB + summary tables); app layer guarantees correctness.
    brandId: text("brand_id"),
    outletId: text("outlet_id"),
    totalStaff: integer("total_staff").notNull().default(0),
    staffPresent: integer("staff_present").notNull().default(0),
    staffLate: integer("staff_late").notNull().default(0),
    staffAbsent: integer("staff_absent").notNull().default(0),
    payrollIssue: text("payroll_issue").notNull().default("none"),
    majorHrIssue: text("major_hr_issue").notNull().default("none"),
    recommendedAction: text("recommended_action"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    dateOutletUnique: unique("hr_daily_summary_date_outlet_unique").on(t.date, t.outlet),
  }),
);

// ============================================================
// Inferred types
// ============================================================

export type HrAttendance = typeof hrAttendance.$inferSelect;
export type NewHrAttendance = typeof hrAttendance.$inferInsert;
export type HrPayroll = typeof hrPayroll.$inferSelect;
export type NewHrPayroll = typeof hrPayroll.$inferInsert;
export type HrPayrollLine = typeof hrPayrollLine.$inferSelect;
export type NewHrPayrollLine = typeof hrPayrollLine.$inferInsert;
export type HrDailySummary = typeof hrDailySummary.$inferSelect;
export type NewHrDailySummary = typeof hrDailySummary.$inferInsert;

// ============================================================
// hr_audit_log — per-domain audit trail for HR state transitions
// (payroll approval, attendance corrections, etc.).
// ============================================================

export const hrAuditLog = hr.table("audit_log", {
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

export type HrAuditLog = typeof hrAuditLog.$inferSelect;
export type NewHrAuditLog = typeof hrAuditLog.$inferInsert;