/**
 * KPI consolidation + headline strip — pure functions, vitest-covered.
 * All money figures are simple sums across per-outlet summary rows.
 */
import type { Headline, OwnerAlert, SummaryRow } from './types';
import { num, sum } from './format';
import { countBySeverity } from './alerts';

export interface FinanceKpi {
  revenue: number;
  grossSales: number;
  expense: number;
  estimasiSurplus: number;
  unpaidSupplier: number;
  cashDifference: number;
  transactions: number;
  aov: number;
  momPct: number | null;
}

export function consolidateFinance(rows: SummaryRow[], prevRows: SummaryRow[] = []): FinanceKpi {
  const revenue = sum(rows, 'net_sales');
  const transactions = sum(rows, 'transaction_count');
  const prevRevenue = sum(prevRows, 'net_sales');
  return {
    revenue,
    grossSales: sum(rows, 'gross_sales'),
    expense: sum(rows, 'total_expense'),
    estimasiSurplus: sum(rows, 'estimated_surplus'),
    unpaidSupplier: sum(rows, 'unpaid_supplier'),
    cashDifference: sum(rows, 'cash_difference'),
    transactions,
    aov: transactions > 0 ? Math.round(revenue / transactions) : 0,
    momPct: prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : null
  };
}

export interface HrKpi {
  scheduled: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  shiftShortage: number;
  payrollIssues: number;
}

export function consolidateHr(rows: SummaryRow[]): HrKpi {
  return {
    scheduled: sum(rows, 'scheduled_staff'),
    present: sum(rows, 'staff_present'),
    late: sum(rows, 'staff_late'),
    absent: sum(rows, 'staff_absent'),
    leave: sum(rows, 'staff_leave'),
    shiftShortage: sum(rows, 'shift_shortage'),
    payrollIssues: sum(rows, 'payroll_issue_count')
  };
}

export interface WarehouseKpi {
  inventoryValue: number;
  criticalLowStock: number;
  stockoutRisk: number;
  unexplainedVariance: number;
  nearExpiry: number;
  expired: number;
  pendingPurchaseRecs: number;
  estimatedPurchaseValue: number;
  wasteValue: number;
}

export function consolidateWarehouse(rows: SummaryRow[]): WarehouseKpi {
  return {
    inventoryValue: sum(rows, 'total_inventory_value'),
    criticalLowStock: sum(rows, 'critical_low_stock_count'),
    stockoutRisk: sum(rows, 'stockout_risk_count'),
    unexplainedVariance: sum(rows, 'unexplained_variance_value'),
    nearExpiry: sum(rows, 'near_expiry_item_count'),
    expired: sum(rows, 'expired_item_count'),
    pendingPurchaseRecs: sum(rows, 'purchase_recommendation_count'),
    estimatedPurchaseValue: sum(rows, 'estimated_purchase_value'),
    wasteValue: sum(rows, 'waste_value')
  };
}

export interface OpsKpi {
  outletsReady: number;
  outletsTotal: number;
  openIncidents: number;
  highSeverityIncidents: number;
  cashDifference: number;
  openActions: number;
  avgChecklist: number;
}

export function consolidateOps(rows: SummaryRow[]): OpsKpi {
  const ready = rows.filter((r) => (r.opening_status ?? '').toUpperCase() === 'READY'
    || (r.closing_status ?? '').toUpperCase() === 'CLOSED').length;
  const checklists = rows.map((r) => num(r.opening_completion_percentage)).filter((n) => n > 0);
  return {
    outletsReady: ready,
    outletsTotal: rows.length,
    openIncidents: sum(rows, 'incident_count'),
    highSeverityIncidents: sum(rows, 'high_severity_incident'),
    cashDifference: sum(rows, 'cash_difference'),
    openActions: sum(rows, 'open_action_count'),
    avgChecklist: checklists.length ? Math.round(checklists.reduce((a, b) => a + b, 0) / checklists.length) : 0
  };
}

export function buildHeadline(input: {
  finance: SummaryRow[];
  financePrev: SummaryRow[];
  hr: SummaryRow[];
  warehouse: SummaryRow[];
  alerts: OwnerAlert[];
}): Headline {
  const fin = consolidateFinance(input.finance, input.financePrev);
  const hr = consolidateHr(input.hr);
  const wh = consolidateWarehouse(input.warehouse);
  return {
    estimasiSurplusKas: fin.estimasiSurplus,
    revenueToday: fin.revenue,
    revenue7dAvg: null, // filled by aggregate layer when history is available
    expenseToday: fin.expense,
    unpaidSupplier: fin.unpaidSupplier,
    staffPresent: hr.present,
    staffLate: hr.late,
    staffAbsent: hr.absent,
    criticalStockCount: wh.criticalLowStock,
    openHighCriticalIncidents: countBySeverity(input.alerts, 'CRITICAL', 'HIGH'),
    cashPosition: fin.revenue - fin.expense + fin.cashDifference
  };
}
