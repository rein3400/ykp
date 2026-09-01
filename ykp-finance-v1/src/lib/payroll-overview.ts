import { payableOf, type HrPayrollRow } from './hr-payroll-bridge';

export interface PayrollBranchRow {
  brand_id: string;
  brand_name: string;
  employee_count: number;
  gross_total: number;
  net_total: number;
  payable_total: number;
  paid_total: number;
}

export interface PayrollTotals {
  gross_total: number;
  net_total: number;
  payable_total: number;
  paid_total: number;
  payable_count: number;
  employee_count: number;
  period: string;
}

export interface PayrollEmployeeRow {
  payroll_id: string;
  employee_id: string;
  employee_name: string;
  brand_id: string;
  brand_name: string;
  outlet_id: string;
  gross: number;
  net: number;
  payable: boolean;
  paid: boolean;
  approval_status: string;
  payment_status: string;
}

export interface PayrollOverview {
  totals: PayrollTotals;
  per_branch: PayrollBranchRow[];
  per_employee: PayrollEmployeeRow[];
}

const num = (v: string | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function aggregatePayroll(
  rows: HrPayrollRow[],
  brandNames: Record<string, string>,
  period: string,
  scope?: { brandId?: string; outletId?: string }
): PayrollOverview {
  const filtered = rows.filter((r) => (!period || r.payroll_period === period)
    && (!scope?.brandId || r.brand_id === scope.brandId)
    && (!scope?.outletId || r.outlet_id === scope.outletId));

  const byBrand = new Map<string, PayrollBranchRow>();
  const perEmployee: PayrollEmployeeRow[] = [];
  const totals: PayrollTotals = {
    gross_total: 0, net_total: 0, payable_total: 0, paid_total: 0, payable_count: 0, employee_count: 0, period
  };

  for (const r of filtered) {
    const n = (k: keyof HrPayrollRow): number => num(r[k] as string);
    const net = n('net_salary');
    const isPayable = payableOf(r);
    const isPaid = (r.payment_status ?? '').toUpperCase() === 'PAID';

    totals.gross_total += n('gross_salary');
    totals.net_total += net;
    if (isPayable) {
      totals.payable_total += net;
      totals.payable_count += 1;
    }
    if (isPaid) totals.paid_total += net;

    const b = byBrand.get(r.brand_id) ?? {
      brand_id: r.brand_id,
      brand_name: brandNames[r.brand_id] ?? r.brand_id,
      employee_count: 0,
      gross_total: 0,
      net_total: 0,
      payable_total: 0,
      paid_total: 0
    };
    b.employee_count += 1;
    b.gross_total += n('gross_salary');
    b.net_total += net;
    if (isPayable) b.payable_total += net;
    if (isPaid) b.paid_total += net;
    byBrand.set(r.brand_id, b);

    perEmployee.push({
      payroll_id: r.payroll_id,
      employee_id: r.employee_id,
      employee_name: r.employee_name,
      brand_id: r.brand_id,
      brand_name: brandNames[r.brand_id] ?? r.brand_id,
      outlet_id: r.outlet_id,
      gross: n('gross_salary'),
      net,
      payable: isPayable,
      paid: isPaid,
      approval_status: r.approval_status,
      payment_status: r.payment_status
    });
  }

  totals.employee_count = new Set(filtered.map((r) => `${r.payroll_period}|${r.employee_id}`)).size;

  return {
    totals,
    per_branch: [...byBrand.values()].sort((a, b) => b.payable_total - a.payable_total),
    per_employee: perEmployee.sort((a, b) => b.net - a.net)
  };
}