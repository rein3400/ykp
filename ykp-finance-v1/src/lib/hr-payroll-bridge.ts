/**
 * Read-only bridge: Finance V1 → HR V1 payroll.
 *
 * Canonical semantics: "harus dibayar" = net_salary where payment_status != 'PAID'
 * and approval_status != 'REJECTED'. Finance never writes HR tabs (cross-domain
 * read-only invariant).
 *
 * In mock mode (or without YKP_HR_SPREADSHEET_ID) rows come from the local mock
 * store, so dev/demo works without the HR spreadsheet.
 */
import { isMockMode, mockReadTab } from '@/db/mock-store';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';

export interface HrPayrollRow { payroll_id: string; payroll_period: string; employee_id: string; employee_name: string; brand_id: string; outlet_id: string; basic_salary: string; attendance_deduction: string; overtime_pay: string; bonus_total: string; penalty_total: string; allowance_total: string; cash_advance_deduction: string; bpjs_deduction: string; tax_deduction: string; gross_salary: string; net_salary: string; approval_status: string; payment_status: string; payment_date: string; created_at: string; finance_notified_at: string; finance_notified_by: string; email_sent_at: string; email_sent_to: string; email_sent_status: string; }

export function payableOf(r: HrPayrollRow): boolean {
  const approval = (r.approval_status ?? '').toUpperCase();
  const payment = (r.payment_status ?? '').toUpperCase();
  return approval !== 'REJECTED' && payment !== 'PAID';
}

export function periodOf(r: HrPayrollRow): string {
  return (r.payroll_period ?? '').slice(0, 7);
}

export async function readHrPayroll(): Promise<HrPayrollRow[]> {
  if (isMockMode() || !process.env.YKP_HR_SPREADSHEET_ID) {
    return normalizeRows(mockReadTab('hr_payroll'));
  }
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets: sheets_v4.Sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.YKP_HR_SPREADSHEET_ID,
    range: 'hr_payroll!A1:AL2000'
  });
  const values = res.data.values ?? [];
  if (values.length < 2) return [];
  const headers = values[0] as string[];
  return normalizeRows(values.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (row[i] as string) ?? ''; });
    return obj;
  }));
}

function normalizeRows(rows: Record<string, string>[]): HrPayrollRow[] {
  return rows.map((r) => ({
    payroll_id: r.payroll_id ?? '',
    payroll_period: r.payroll_period ?? '',
    employee_id: r.employee_id ?? '',
    employee_name: r.employee_name ?? '',
    brand_id: r.brand_id ?? '',
    outlet_id: r.outlet_id ?? '',
    basic_salary: r.basic_salary ?? '0',
    attendance_deduction: r.attendance_deduction ?? '0',
    overtime_pay: r.overtime_pay ?? '0',
    bonus_total: r.bonus_total ?? '0',
    penalty_total: r.penalty_total ?? '0',
    allowance_total: r.allowance_total ?? '0',
    cash_advance_deduction: r.cash_advance_deduction ?? '0',
    bpjs_deduction: r.bpjs_deduction ?? '0',
    tax_deduction: r.tax_deduction ?? '0',
    gross_salary: r.gross_salary ?? '0',
    net_salary: r.net_salary ?? '0',
    approval_status: r.approval_status ?? '',
    payment_status: r.payment_status ?? '',
    payment_date: r.payment_date ?? '',
    created_at: r.created_at ?? '',
    finance_notified_at: r.finance_notified_at ?? '',
    finance_notified_by: r.finance_notified_by ?? '',
    email_sent_at: r.email_sent_at ?? '',
    email_sent_to: r.email_sent_to ?? '',
    email_sent_status: r.email_sent_status ?? ''
  }));
}