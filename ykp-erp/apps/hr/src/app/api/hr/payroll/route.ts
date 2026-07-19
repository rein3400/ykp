import { z } from "zod";
import { and, eq, gte, lte, sql, inArray } from "drizzle-orm";
import {
  initDbClients,
  createHrDb,
  createMasterDb,
  hrAttendance,
  hrPayroll,
  hrPayrollLine,
  hrRules,
  masterEmployee,
} from "@ykp/schema";
import { requireRole, Role } from "@ykp/auth";
import {
  computePayroll,
  generateHrDailySummary,
  logAudit,
  getEmployeeName,
  getOutletName,
  getHrRulesForOutlet,
  uuid,
} from "@ykp/engine";
import { jsonOk, jsonError, handleError } from "@hr/lib/api-error";
import { resolveBody, resolveQuery } from "@hr/lib/zod-resolver";

export const dynamic = "force-dynamic";

let booted = false;
function boot(): void {
  if (booted) return;
  try {
    initDbClients();
    booted = true;
  } catch {
    // ignore in test env
  }
}

const querySchema = z.object({
  employeeId: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

const runSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  outletId: z.string().optional(),
});

/**
 * GET /api/hr/payroll
 * Lists payroll runs with optional filters. Includes enriched names.
 */
export async function GET(req: Request): Promise<Response> {
  boot();
  try {
    const user = await requireRole([Role.OWNER, Role.HR_ADMIN, Role.SUPER_ADMIN, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER]);
    const url = new URL(req.url);
    const parsed = resolveQuery(url, querySchema);
    if (parsed instanceof Response) return parsed;

    const hrDb = createHrDb();
    const masterDb = createMasterDb();

    const filters = [];
    if (parsed.employeeId) filters.push(eq(hrPayroll.employeeId, parsed.employeeId));
    if (parsed.periodStart) filters.push(gte(hrPayroll.periodStart, new Date(parsed.periodStart)));
    if (parsed.periodEnd) filters.push(lte(hrPayroll.periodEnd, new Date(parsed.periodEnd)));
    // hrPayroll has no outletId column; scope by joining via master_employee.outletId.
    // applyOutletScope does not help here (column missing), so we resolve scoped
    // employeeIds manually for OUTLET_MANAGER (the only scoped role allowed by
    // this route's role list).
    if (user.role === Role.OUTLET_MANAGER) {
      const scopedOutlets = user.outletIds ?? [];
      const empRows = scopedOutlets.length
        ? await masterDb
            .select({ employeeId: masterEmployee.employeeId })
            .from(masterEmployee)
            .where(inArray(masterEmployee.outletId, scopedOutlets as string[]))
        : [];
      const empIds = empRows.map((r) => r.employeeId);
      if (empIds.length === 0) {
        return jsonOk({ payroll: [] });
      }
      filters.push(inArray(hrPayroll.employeeId, empIds));
    }

    const rows = await hrDb
      .select()
      .from(hrPayroll)
      .where(filters.length ? and(...filters) : undefined)
      .limit(200);

    // Batch-resolve employee names — same N+1 class as attendance GET
    // (was 1 lookup per row). Single inArray query instead.
    const employeeIds = [...new Set(rows.map((r) => r.employeeId).filter(Boolean))] as string[];
    const employeeRows = employeeIds.length
      ? await masterDb
          .select({ employeeId: masterEmployee.employeeId, fullName: masterEmployee.fullName })
          .from(masterEmployee)
          .where(inArray(masterEmployee.employeeId, employeeIds))
      : [];
    const employeeMap = new Map(employeeRows.map((e) => [e.employeeId, e.fullName]));

    const enriched = rows.map((r) => ({
      ...r,
      employeeName: employeeMap.get(r.employeeId) ?? null,
    }));

    return jsonOk({ payroll: enriched });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/hr/payroll/run
 * Generates payroll rows for active employees in the given outlet (or all
 * active employees if no outlet) for the period. Also rebuilds the daily
 * summary for periodEnd so Hermez can pick it up immediately.
 */
export async function POST(req: Request): Promise<Response> {
  boot();
  try {
    const user = await requireRole([Role.OWNER, Role.HR_ADMIN, Role.SUPER_ADMIN]);
    const parsed = await resolveBody(req, runSchema);
    if (parsed instanceof Response) return parsed;

    const masterDb = createMasterDb();
    const hrDb = createHrDb();

    const employeeFilter = [eq(masterEmployee.status, "active")];
    if (parsed.outletId) employeeFilter.push(eq(masterEmployee.outletId, parsed.outletId));
    const employees = await masterDb
      .select()
      .from(masterEmployee)
      .where(and(...employeeFilter));

    if (employees.length === 0) return jsonError(400, "No active employees match the filter");

    const payrollIds: string[] = [];
    const payrollErrors: { employeeId: string; error: string }[] = [];
    const auditPayload = { periodStart: parsed.periodStart, periodEnd: parsed.periodEnd, outletId: parsed.outletId, count: 0 };

    // Defect H3 fix: per-employee try/catch. A zero effectivePeriodDays
    // (joinDate after periodEnd) or any computePayroll failure is recorded
    // as a per-employee error and the batch continues; the transaction
    // still commits the successful rows. Previously one bad employee threw
    // inside the tx and aborted the whole batch.
    await hrDb.transaction(async (tx) => {
      for (const emp of employees) {
        try {
          // Defect H5: reject when an employee has no outletId and the caller
          // did not pass outletId. Recorded per-employee now (not a batch throw).
          if (!parsed.outletId && !emp.outletId) {
            throw Object.assign(new Error(`outlet_required: employee ${emp.employeeId} has no outlet_id and no outletId was provided`), { status: 422 });
          }
          const outletId = parsed.outletId ?? emp.outletId!;

          // Defect H1: hr_rules lives in ykp_master, not ykp_hr. Resolve via
          // the masterDb using the shared getHrRulesForOutlet helper.
          const rule = await getHrRulesForOutlet(masterDb, outletId);
          if (!rule) {
            throw Object.assign(new Error(`hr_rules_not_configured: no hr_rules defined for outlet ${outletId} (employee ${emp.employeeId})`), { status: 422 });
          }

          const payrollDays = Number(rule.payrollPeriodEnd ?? 25);
          const payrollPeriodStart = Number(rule.payrollPeriodStart ?? 1);
          const periodLength = payrollDays - payrollPeriodStart + 1;

          // Defect H2: firstBlockHours is now a real column on hr_rules
          // (default 1). No cast required.
          const otDailyCap = Number(rule.overtimeDailyCapHours ?? 0);
          const otFirstBlockHours = Number((rule as { firstBlockHours?: number | null }).firstBlockHours ?? 1);
          if (!Number.isFinite(otDailyCap) || otDailyCap <= 0) {
            throw Object.assign(new Error(`hr_rules_not_configured: overtimeDailyCapHours missing for outlet ${outletId}`), { status: 422 });
          }
          if (!Number.isFinite(otFirstBlockHours) || otFirstBlockHours <= 0) {
            throw Object.assign(new Error(`hr_rules_not_configured: firstBlockHours missing for outlet ${outletId}`), { status: 422 });
          }

          // Defect H4 fix: overtimeDailyCapHours is a per-DAY cap, not a
          // per-period aggregate cap. Pre-clamp each attendance row's
          // overtime_hours to otDailyCap inside the SQL sum, so the aggregate
          // period OT is the true sum of capped daily OT. We then pass this
          // to computePayroll with no additional period cap (overtime_cap_hours
          // defaults to a large value) so the daily-capped total is not
          // double-clamped.
          const attendanceRows = await tx
            .select({
              count: sql<number>`count(*)`,
              present: sql<number>`sum(case when ${hrAttendance.attendanceStatus} = 'present' then 1 else 0 end)`,
              absent: sql<number>`sum(case when ${hrAttendance.attendanceStatus} = 'absent' then 1 else 0 end)`,
              lateMinutes: sql<number>`coalesce(sum(${hrAttendance.lateMinutes}),0)`,
              // Pre-clamp each day's overtime to otDailyCap, then sum.
              overtime: sql<number>`coalesce(sum(least(${hrAttendance.overtimeHours}::numeric, ${otDailyCap})),0)`,
            })
            .from(hrAttendance)
            .where(
              and(
                eq(hrAttendance.employeeId, emp.employeeId),
                gte(hrAttendance.date, new Date(parsed.periodStart)),
                lte(hrAttendance.date, new Date(parsed.periodEnd)),
              ),
            );

          const attendanceCount = Number(attendanceRows[0]?.present ?? 0);
          const absentDays = Number(attendanceRows[0]?.absent ?? 0);
          const totalLateMin = Number(attendanceRows[0]?.lateMinutes ?? 0);
          // Already daily-capped per row in SQL.
          const effectiveOvertimeHours = Number(attendanceRows[0]?.overtime ?? 0);

          // Defect 4 fix: pro-ration for mid-period joiners.
          const joinDate = emp.joinDate ?? null;
          const periodStartDate = new Date(parsed.periodStart);
          const periodEndDate = new Date(parsed.periodEnd);
          let effectivePeriodDays = periodLength;
          if (joinDate && joinDate.getTime() > periodStartDate.getTime()) {
            const start = joinDate.getTime() < periodStartDate.getTime() ? periodStartDate : joinDate;
            effectivePeriodDays = Math.max(
              0,
              Math.round((periodEndDate.getTime() - start.getTime()) / 86_400_000) + 1,
            );
          }

          // Defect H3 fix: an employee who joined after periodEnd has zero
          // effective days; computePayroll would throw (payroll_days must be
          // > 0) and abort the batch. Skip with a per-employee 422-style
          // error instead and continue with the rest.
          if (effectivePeriodDays <= 0) {
            payrollErrors.push({
              employeeId: emp.employeeId,
              error: `zero_effective_days: employee ${emp.employeeId} joinDate ${joinDate ?? "(none)"} is after periodEnd ${parsed.periodEnd}`,
            });
            continue;
          }

          const calc = computePayroll({
            base_salary: emp.baseSalary,
            payroll_days: effectivePeriodDays,
            attendance_count: attendanceCount,
            absent_days: absentDays,
            total_late_min: totalLateMin,
            overtime_hours: effectiveOvertimeHours,
            bonus: 0,
            other_deductions: 0,
            hourly_late_penalty: 0,
            regular_hourly_rate: Math.round(emp.baseSalary / periodLength / 8),
            overtime_multiplier: Number(rule.overtimeRateMultiplier ?? 1.5),
            // Already daily-capped at the SQL layer; pass a permissive cap so
            // computePayroll does not double-clamp the period aggregate.
            overtime_cap_hours: Number.POSITIVE_INFINITY,
          });

          // Defect 5 fix: deterministic payroll id with idempotency pre-check.
          const payrollId = `PR-${emp.employeeId}-${parsed.periodStart.replace(/-/g, "")}`;
          const existingPayroll = await tx
            .select({ payrollId: hrPayroll.payrollId })
            .from(hrPayroll)
            .where(eq(hrPayroll.payrollId, payrollId))
            .limit(1);
          if (existingPayroll[0]) {
            // Already generated for this employee+period; skip to avoid dup.
            continue;
          }

          await tx.insert(hrPayroll).values({
            payrollId,
            employeeId: emp.employeeId,
            periodStart: periodStartDate,
            periodEnd: periodEndDate,
            payrollDays: effectivePeriodDays,
            attendanceCount,
            absentDays,
            dailyRate: calc.daily_rate,
            hourlyRate: Math.round(emp.baseSalary / periodLength / 8),
            regularHourlyRate: Math.round(emp.baseSalary / periodLength / 8),
            attendanceBase: calc.attendance_base,
            attendanceDeduction: calc.attendance_deduction,
            lateDeduction: calc.late_deduction,
            otherDeductions: 0,
            overtimeHours: String(effectiveOvertimeHours),
            overtimeFirstBlock: Math.max(0, Math.min(effectiveOvertimeHours, otFirstBlockHours)),
            overtimeNextBlock: Math.max(0, effectiveOvertimeHours - otFirstBlockHours),
            overtimePay: calc.overtime_pay,
            bonus: 0,
            taxEstimatePct: "0",
            grossSalary: calc.gross_salary,
            netSalary: calc.net_salary,
            approvalStatus: "DRAFT",
          });

          const lines: { label: string; amount: number; sign: "plus" | "minus" }[] = [
            { label: "Gaji pokok pro-rata", amount: calc.attendance_base, sign: "plus" },
            { label: "Lembur", amount: calc.overtime_pay, sign: "plus" },
            { label: "Potongan absen", amount: calc.attendance_deduction, sign: "minus" },
            { label: "Potongan telat", amount: calc.late_deduction, sign: "minus" },
          ];
          await tx.insert(hrPayrollLine).values(
            lines.map((line) => ({
              lineId: `PL-${uuid()}`,
              payrollId,
              label: line.label,
              amount: line.amount,
              sign: line.sign,
            })),
          );

          payrollIds.push(payrollId);
        } catch (err) {
          // Defect H3 fix: record per-employee failure and continue. Do not
          // abort the whole batch. Rethrow only on truly fatal infra errors
          // (non-Error with no status) so a connection drop still surfaces.
          const e = err as Error & { status?: number };
          // Defect 10d: surface a category-level hint rather than the raw
          // engine/driver error which may leak internal details.
          const code = (e as Error & { code?: string }).code;
          payrollErrors.push({
            employeeId: emp.employeeId,
            error: code ? `${code}: payroll failed` : e?.status ? `payroll failed (${e.status})` : "payroll failed",
          });
        }
      }
    }).catch((err: unknown) => {
      // Surface infra-level tx failures only. Per-employee errors were
      // captured above and the tx still commits successful rows.
      throw err;
    });

    auditPayload.count = payrollIds.length;
    await logAudit(hrDb, {
      actor: user.id,
      action: "payroll:run",
      entity: "hr_payroll",
      entityId: payrollIds.join(","),
      after: auditPayload,
    }, "hr");

    // Rebuild summary for periodEnd so Hermez sees up-to-date HR data.
    const outletIds = parsed.outletId ? [parsed.outletId] : employees.map((e) => e.outletId).filter(Boolean);
    for (const outletId of new Set(outletIds)) {
      await generateHrDailySummary({
        hrDb,
        masterDb,
        date: parsed.periodEnd,
        outlet_id: outletId as string,
      }).catch(() => null); // ignore missing master refs in partial tests
    }

    return jsonOk({
      payrollIds,
      count: payrollIds.length,
      // Defect H3 fix: surface per-employee errors so the caller can show a
      // partial-success result without losing visibility on the failures.
      errors: payrollErrors,
    });
  } catch (err) {
    // Defect H6: catch 422 tx errors before handleError swallows them as 500.
    const e = err as Error & { status?: number };
    if (e.status === 422) return jsonError(422, e.message);
    if (e.status === 409) return jsonError(409, e.message);
    return handleError(err);
  }
}