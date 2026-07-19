/**
 * Built-in mock dataset — lets the whole dashboard demo offline.
 * Activated when YKP_OWNER_MOCK=true OR every module is unreachable.
 * Mirrors the sibling mock stores: 5 brands (Funkydak, Sekarpizza,
 * Suburbuns, Laju Kopi, Uncle Masala), 7 outlets, realistic KPIs,
 * alerts across severities and actions with PIC/deadline.
 */
import type { ModuleResult, OwnerAction, OwnerAlert, OwnerOverview, SummaryRow } from './types';
import { MODULES, moduleUrl } from './modules';
import { todayWib } from './format';
import { sortAlerts, isOpenStatus, isOverdue } from './alerts';
import { buildHeadline } from './consolidate';

const BRANDS: [string, string][] = [
  ['BR-001', 'Funkydak'],
  ['BR-002', 'Sekarpizza'],
  ['BR-003', 'Suburbuns'],
  ['BR-004', 'Laju Kopi'],
  ['BR-005', 'Uncle Masala']
];

const OUTLETS: { id: string; brand: string; name: string; base: number }[] = [
  { id: 'OL-001', brand: 'BR-001', name: 'Funkydak Cipete', base: 5200000 },
  { id: 'OL-002', brand: 'BR-001', name: 'Funkydak Kemang', base: 4100000 },
  { id: 'OL-003', brand: 'BR-002', name: 'Sekarpizza Demangan', base: 3800000 },
  { id: 'OL-004', brand: 'BR-002', name: 'Sekarpizza Seturan', base: 3200000 },
  { id: 'OL-005', brand: 'BR-003', name: 'Suburbuns Depok', base: 2600000 },
  { id: 'OL-006', brand: 'BR-004', name: 'Laju Kopi Bintaro', base: 2200000 },
  { id: 'OL-007', brand: 'BR-005', name: 'Uncle Masala Tebet', base: 2900000 }
];

function brandName(id: string): string {
  return BRANDS.find(([b]) => b === id)?.[1] ?? id;
}

const rupiah = (n: number) => String(Math.round(n));

function mockFinanceRows(date: string): SummaryRow[] {
  return OUTLETS.map((o, i) => {
    const wave = 1 + 0.12 * Math.sin(i * 1.7);
    const net = o.base * wave;
    const expense = net * (0.32 + 0.03 * ((i + 1) % 3));
    const tx = Math.round(net / (52000 + i * 3000));
    return {
      summary_id: `FIN-${date}-${o.id}`,
      date,
      brand_id: o.brand,
      brand_name: brandName(o.brand),
      outlet_id: o.id,
      outlet_name: o.name,
      gross_sales: rupiah(net * 1.04),
      net_sales: rupiah(net),
      discount: rupiah(net * 0.03),
      refund: i === 2 ? '150000' : '0',
      void: i === 2 ? '75000' : '0',
      transaction_count: String(tx),
      aov: rupiah(net / tx),
      supplier_cost: rupiah(expense * 0.55),
      petty_cash_out: rupiah(expense * 0.1),
      total_expense: rupiah(expense),
      unpaid_supplier: i % 2 === 0 ? rupiah(1200000 + i * 350000) : '0',
      cash_difference: o.id === 'OL-005' ? '-75000' : '0',
      estimated_surplus: rupiah(net - expense),
      top_supplier: 'CV Sumber Ayam Segar',
      top_expense_category: 'Bahan Baku',
      major_finance_issue: o.id === 'OL-005' ? 'Selisih kas -Rp75.000 saat closing' : '',
      recommended_action: o.id === 'OL-005' ? 'Audit closing kas Suburbuns Depok' : '',
      created_at: `${date} 21:45:00`
    };
  });
}

function mockHrRows(date: string): SummaryRow[] {
  return OUTLETS.map((o, i) => {
    const scheduled = 4 + (i % 3);
    const late = i === 1 || i === 4 ? 2 : i % 2;
    const absent = i === 4 ? 1 : 0;
    return {
      summary_id: `HR-${date}-${o.id}`,
      date,
      brand_id: o.brand,
      brand_name: brandName(o.brand),
      outlet_id: o.id,
      outlet_name: o.name,
      total_staff: String(scheduled + 1),
      scheduled_staff: String(scheduled),
      staff_present: String(scheduled - absent),
      staff_late: String(late),
      staff_absent: String(absent),
      staff_leave: i === 2 ? '1' : '0',
      incomplete_attendance: i === 4 ? '1' : '0',
      total_late_minutes: String(late * (12 + i * 3)),
      overtime_hours: i === 0 ? '3' : '0',
      shift_shortage: o.id === 'OL-004' ? '1' : '0',
      payroll_issue_count: '0',
      major_hr_issue: o.id === 'OL-004' ? 'Kekurangan 1 orang shift malam' : '',
      recommended_action: o.id === 'OL-004' ? 'Briefing SPV absensi Sekarpizza Seturan' : '',
      created_at: `${date} 21:40:00`
    };
  });
}

function mockWarehouseRows(date: string): SummaryRow[] {
  return OUTLETS.map((o, i) => ({
    summary_id: `WH-${date}-${o.id}`,
    date,
    brand_id: o.brand,
    brand_name: brandName(o.brand),
    outlet_id: o.id,
    outlet_name: o.name,
    location_id: `LOC-${o.id}`,
    total_inventory_value: rupiah(8500000 + i * 1400000),
    critical_low_stock_count: o.id === 'OL-001' ? '3' : o.id === 'OL-006' ? '2' : '0',
    stockout_risk_count: o.id === 'OL-001' ? '2' : '0',
    purchase_recommendation_count: o.id === 'OL-001' ? '2' : i === 5 ? '1' : '0',
    estimated_purchase_value: o.id === 'OL-001' ? '2350000' : i === 5 ? '900000' : '0',
    pending_purchase_request_count: i === 0 ? '1' : '0',
    pending_receiving_count: '0',
    receiving_discrepancy_count: i === 3 ? '1' : '0',
    pending_transfer_count: '0',
    transfer_discrepancy_count: '0',
    waste_item_count: String(i % 3),
    waste_value: rupiah((i % 3) * 85000),
    variance_item_count: i === 2 ? '2' : '0',
    unexplained_variance_value: i === 2 ? '320000' : '0',
    near_expiry_item_count: o.id === 'OL-007' ? '4' : i % 2 === 0 ? '1' : '0',
    expired_item_count: o.id === 'OL-007' ? '1' : '0',
    open_action_count: o.id === 'OL-001' ? '2' : '0',
    overdue_action_count: o.id === 'OL-007' ? '1' : '0',
    major_warehouse_issue: o.id === 'OL-001' ? 'Ayam fillet & tepung di bawah stok minimum' : '',
    recommended_action: o.id === 'OL-001' ? 'Approve purchase recommendation Funkydak Cipete' : '',
    generated_at: `${date} 21:50:00`
  }));
}

function mockOpsRows(date: string): SummaryRow[] {
  return OUTLETS.map((o, i) => ({
    summary_id: `OPS-${date}-${o.id}`,
    date,
    brand_id: o.brand,
    brand_name: brandName(o.brand),
    outlet_id: o.id,
    outlet_name: o.name,
    opening_status: i === 6 ? 'LATE' : 'READY',
    opening_completion_percentage: i === 6 ? '70' : '100',
    critical_opening_issue: i === 6 ? 'Gas telat datang' : '',
    scheduled_staff: String(4 + (i % 3)),
    actual_staff: String(4 + (i % 3) - (i === 4 ? 1 : 0)),
    shift_shortage: i === 4 ? '1' : '0',
    total_orders: String(Math.round(o.base / 55000)),
    avg_serving_time: String(8 + (i % 4)),
    orders_over_sla: i === 2 ? '3' : '0',
    critical_delay_count: '0',
    avg_qc_score: String(88 + (i % 5)),
    qc_fail_count: '0',
    incident_count: i === 5 ? '2' : i % 3 === 0 ? '1' : '0',
    high_severity_incident: i === 5 ? '1' : '0',
    complaint_count: i === 2 ? '1' : '0',
    waste_qty: String(i % 3),
    waste_value: rupiah((i % 3) * 85000),
    stock_issue_count: '0',
    closing_status: i === 6 ? 'OPEN' : 'CLOSED',
    cash_difference: o.id === 'OL-005' ? '-75000' : '0',
    open_action_count: i === 5 ? '2' : '0',
    major_ops_issue: i === 5 ? 'Kompor mati saat jam makan malam' : '',
    recommended_action: i === 5 ? 'Panggil teknisi kompor Laju Kopi Bintaro' : '',
    created_at: `${date} 21:55:00`
  }));
}

function mockInvestorRows(date: string): SummaryRow[] {
  const fin = mockFinanceRows(date);
  const revenue = fin.reduce((s, r) => s + Number(r.net_sales), 0);
  const profit = fin.reduce((s, r) => s + Number(r.estimated_surplus), 0);
  return [{
    summary_id: `INV-${date}`,
    date,
    total_revenue: rupiah(revenue),
    total_profit: rupiah(profit),
    total_capital: '750000000',
    active_investors: '6',
    dividend_declared: '45000000',
    growth_pct: '8.4',
    created_at: `${date} 22:00:00`
  }];
}

function mockAlerts(date: string): OwnerAlert[] {
  const w = MODULES.warehouse;
  const f = MODULES.finance;
  const o = MODULES.ops;
  const h = MODULES.hr;
  return sortAlerts([
    {
      id: 'ALR-MOCK-001', module: 'warehouse', severity: 'CRITICAL',
      brand: 'Funkydak', outlet: 'Funkydak Cipete',
      title: 'Stok kritis', message: '3 item stok kritis di Funkydak Cipete (ayam fillet, tepung, minyak)',
      time: `${date} 16:20`, status: 'OPEN',
      deepLink: moduleUrl(w, w.pages.alerts)
    },
    {
      id: 'ALR-MOCK-002', module: 'finance', severity: 'HIGH',
      brand: 'Suburbuns', outlet: 'Suburbuns Depok',
      title: 'Selisih kas', message: 'Selisih kas -Rp75.000 di Suburbuns Depok saat closing',
      time: `${date} 21:35`, status: 'OPEN',
      deepLink: moduleUrl(f, f.pages.alerts)
    },
    {
      id: 'ALR-MOCK-003', module: 'ops', severity: 'HIGH',
      brand: 'Laju Kopi', outlet: 'Laju Kopi Bintaro',
      title: 'Insiden berat', message: 'Kompor mati saat jam makan malam di Laju Kopi Bintaro',
      time: `${date} 19:05`, status: 'OPEN',
      deepLink: moduleUrl(o, o.pages.alerts)
    },
    {
      id: 'ALR-MOCK-004', module: 'warehouse', severity: 'MEDIUM',
      brand: 'Uncle Masala', outlet: 'Uncle Masala Tebet',
      title: 'Near expiry', message: '4 item mendekati kedaluwarsa di Uncle Masala Tebet (< 3 hari)',
      time: `${date} 09:15`, status: 'OPEN',
      deepLink: moduleUrl(w, w.pages.alerts)
    },
    {
      id: 'ALR-MOCK-005', module: 'hr', severity: 'MEDIUM',
      brand: 'Sekarpizza', outlet: 'Sekarpizza Seturan',
      title: 'Kekurangan shift', message: 'Kekurangan 1 orang shift malam di Sekarpizza Seturan',
      time: `${date} 15:00`, status: 'OPEN',
      deepLink: moduleUrl(h, h.pages.alerts)
    },
    {
      id: 'ALR-MOCK-006', module: 'warehouse', severity: 'LOW',
      brand: 'Sekarpizza', outlet: 'Sekarpizza Demangan',
      title: 'Varian opname', message: 'Selisih opname Rp320.000 belum terjelaskan di Sekarpizza Demangan',
      time: `${date} 11:40`, status: 'OPEN',
      deepLink: moduleUrl(w, w.pages.alerts)
    }
  ]);
}

function mockActions(date: string, today: string): OwnerAction[] {
  const w = MODULES.warehouse;
  const o = MODULES.ops;
  const f = MODULES.finance;
  const yesterday = new Date(`${today}T00:00:00+07:00`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const y = yesterday.toISOString().slice(0, 10);
  const list: OwnerAction[] = [
    {
      id: 'ACT-MOCK-001', module: 'warehouse',
      title: 'Approve purchase recommendation Funkydak Cipete',
      brand: 'Funkydak', outlet: 'Funkydak Cipete', pic: 'Manager Gudang',
      dueDate: today, status: 'OPEN', overdue: false,
      deepLink: moduleUrl(w, w.pages.actions)
    },
    {
      id: 'ACT-MOCK-002', module: 'ops',
      title: 'Panggil teknisi kompor Laju Kopi Bintaro',
      brand: 'Laju Kopi', outlet: 'Laju Kopi Bintaro', pic: 'SPV Laju Kopi',
      dueDate: y, status: 'OPEN', overdue: true,
      deepLink: moduleUrl(o, o.pages.actions)
    },
    {
      id: 'ACT-MOCK-003', module: 'finance',
      title: 'Audit closing kas Suburbuns Depok',
      brand: 'Suburbuns', outlet: 'Suburbuns Depok', pic: 'Owner',
      dueDate: today, status: 'IN_PROGRESS', overdue: false,
      deepLink: moduleUrl(f, f.pages.actions)
    },
    {
      id: 'ACT-MOCK-004', module: 'warehouse',
      title: 'Buang item kedaluwarsa Uncle Masala Tebet',
      brand: 'Uncle Masala', outlet: 'Uncle Masala Tebet', pic: 'Kepala Outlet',
      dueDate: y, status: 'OPEN', overdue: true,
      deepLink: moduleUrl(w, w.pages.actions)
    }
  ];
  return list
    .filter((a) => isOpenStatus(a.status))
    .map((a) => ({ ...a, overdue: a.overdue || isOverdue(a.status, a.dueDate, today) }));
}

function mockPurchaseRecs(date: string): SummaryRow[] {
  return [
    {
      recommendation_id: 'PR-MOCK-001', date, item_id: 'ITM-001', item_name: 'Ayam Fillet (kg)',
      brand_id: 'BR-001', outlet_id: 'OL-001', recommended_qty: '25', unit: 'kg',
      estimated_cost: '1875000', recommendation_status: 'PENDING',
      reason: 'Stok di bawah minimum (sisa 4 kg, cover 1 hari)'
    },
    {
      recommendation_id: 'PR-MOCK-002', date, item_id: 'ITM-014', item_name: 'Tepung Terigu (kg)',
      brand_id: 'BR-001', outlet_id: 'OL-001', recommended_qty: '20', unit: 'kg',
      estimated_cost: '475000', recommendation_status: 'PENDING',
      reason: 'Stok kritis — risiko stockout besok'
    },
    {
      recommendation_id: 'PR-MOCK-003', date, item_id: 'ITM-031', item_name: 'Susu Segar (liter)',
      brand_id: 'BR-004', outlet_id: 'OL-006', recommended_qty: '30', unit: 'liter',
      estimated_cost: '900000', recommendation_status: 'PENDING',
      reason: 'Days-of-cover 2 hari < threshold 3 hari'
    }
  ];
}

/** Build the full OwnerOverview from the mock dataset. */
export function mockOverview(now: Date = new Date(), forced = true): OwnerOverview {
  const date = todayWib(now);
  const gen = now.toISOString();

  const mk = (key: keyof typeof MODULES, rows: SummaryRow[], extra?: Partial<ModuleResult>): ModuleResult => {
    const def = MODULES[key];
    return {
      key, label: def.label, status: 'mock', reachable: true,
      latencyMs: null, summaryDate: date, rows,
      recordCount: rows.length, alerts: [], alertsUnavailable: false,
      actions: [], purchaseRecs: [], error: null,
      deepLink: moduleUrl(def, def.pages.home),
      ...extra
    };
  };

  const alerts = mockAlerts(date);
  const actions = mockActions(date, date);
  const modules: OwnerOverview['modules'] = {
    finance: mk('finance', mockFinanceRows(date), { recordCount: 98 }),
    hr: mk('hr', mockHrRows(date), { recordCount: 98 }),
    warehouse: mk('warehouse', mockWarehouseRows(date), {
      alerts: alerts.filter((a) => a.module === 'warehouse'),
      actions: actions.filter((a) => a.module === 'warehouse'),
      purchaseRecs: mockPurchaseRecs(date),
      recordCount: 96
    }),
    ops: mk('ops', mockOpsRows(date), { recordCount: 97 }),
    investor: mk('investor', mockInvestorRows(date))
  };

  const headline = buildHeadline({
    finance: modules.finance.rows,
    financePrev: [],
    hr: modules.hr.rows,
    warehouse: modules.warehouse.rows,
    alerts
  });
  headline.revenue7dAvg = Math.round(headline.revenueToday * 0.94);

  return {
    date, generatedAt: gen, mock: true, mockForced: forced,
    modules, alerts, actions, headline
  };
}
