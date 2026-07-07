/**
 * NO-WRITE-BACK GUARD — Hermez read-only boundary.
 *
 * Rule: this app MUST NOT import or use INSERT/UPDATE/DELETE helpers for any
 * of the following HR or Finance tables:
 *   hr_attendance, hr_payroll, hr_payroll_line, hr_daily_summary,
 *   fin_pos_daily, fin_supplier_cost, fin_petty_cash, fin_expense,
 *   fin_opening_balance, fin_closing_cash, fin_daily_summary.
 *
 * Hermez may only READ from:
 *   - hr_daily_summary (alert + brief source)
 *   - fin_daily_summary (alert + brief source)
 *   - master_brand, master_outlet, master_supplier, master_employee (lookups)
 *
 * Hermez may WRITE to:
 *   - hermez_daily_brief
 *   - hermez_alert_log
 *   - hermez_config
 *   - hermez_audit_log
 *
 * Violations must fail CI. Grep command for CI:
 *   grep -rn "hr_attendance\|hr_payroll\|fin_pos_daily\|fin_supplier_cost\|fin_petty_cash\|fin_expense\|fin_closing_cash" \
 *     apps/hermez/src/app/api/ \
 *     apps/hermez/src/features/ \
 *     apps/hermez/src/lib/ \
 *     | grep -v "hr_daily_summary\|fin_daily_summary\|master_brand\|master_outlet\|master_supplier\|master_employee" \
 *     | grep -v "\.select("
 */

export const HERMEZ_WRITEBACK_ENABLED = false;
export type HermezWriteScope = "hermez_only";
