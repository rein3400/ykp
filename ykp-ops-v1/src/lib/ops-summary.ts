/**
 * Operational daily summary engine.
 * Aggregates opening, KDS, QC, incidents, closing, waste, stock issues.
 */
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { nextSequentialIdSync } from '@/lib/repo';
import { getBrandName, getOutletName } from '@/lib/repo';
import { todayWib, formatIdr } from '@/lib/format';

export async function generateDailySummary(opts?: { date?: string; brandId?: string; outletId?: string }): Promise<Record<string, string>[]> {
  const date = opts?.date ?? todayWib();
  const openingRows = await readTab(TABS.opening);
  const kdsRows = await readTab(TABS.kds);
  const qcRows = await readTab(TABS.qc);
  const incidentRows = await readTab(TABS.incidents);
  const closingRows = await readTab(TABS.closing);
  const wasteRows = await readTab(TABS.waste);
  const stockRows = await readTab(TABS.stockIssues);
  const briefingRows = await readTab(TABS.briefing);

  const outlets = (await readTab(TABS.outlets)).filter((o) =>
    (!opts?.brandId || o.brand_id === opts.brandId) &&
    (!opts?.outletId || o.outlet_id === opts.outletId)
  );

  const summaries: Record<string, string>[] = [];

  for (const outlet of outlets) {
    const brandId = outlet.brand_id;
    const outletId = outlet.outlet_id;
    const brandName = await getBrandName(brandId);
    const outletName = await getOutletName(outletId);

    const open = openingRows.filter((r) => r.date === date && r.outlet_id === outletId);
    const openTotal = open.length;
    const openDone = open.filter((r) => r.status === 'DONE').length;
    const openCritical = open.filter((r) => r.critical_flag === 'true' && r.status !== 'DONE').length;
    const openPct = openTotal > 0 ? Math.round((openDone / openTotal) * 100) : 100;

    const kds = kdsRows.filter((r) => r.date === date && r.outlet_id === outletId);
    const totalOrders = kds.length;
    const serving = kds.filter((r) => Number(r.serving_seconds) > 0);
    const avgServe = serving.length
      ? Math.round(serving.reduce((s, r) => s + Number(r.serving_seconds), 0) / serving.length)
      : 0;
    const overSla = kds.filter((r) => r.sla_status === 'OVER_SLA').length;
    const criticalDelay = kds.filter((r) => r.sla_status === 'CRITICAL_DELAY').length;

    const qc = qcRows.filter((r) => r.date === date && r.outlet_id === outletId);
    const qcScored = qc.filter((r) => Number(r.score) > 0 && Number(r.max_score) > 0);
    const avgQc = qcScored.length
      ? (qcScored.reduce((s, r) => s + Number(r.score) / Number(r.max_score), 0) / qcScored.length * 5).toFixed(1)
      : '0';
    const qcFail = qc.filter((r) => r.status === 'FAIL').length;

    const incidents = incidentRows.filter((r) => r.date === date && r.outlet_id === outletId);
    const incidentCount = incidents.length;
    const highIncident = incidents.filter((r) => r.severity === 'HIGH' || r.severity === 'CRITICAL').length;
    const complaintCount = incidents.filter((r) => r.incident_type === 'COMPLAINT').length;
    const openActions = incidents.filter((r) => r.status !== 'DONE' && r.status !== 'CANCELLED').length
      + stockRows.filter((r) => r.date === date && r.outlet_id === outletId && r.status !== 'RESOLVED').length;

    const closing = closingRows.filter((r) => r.date === date && r.outlet_id === outletId);
    const closingStatus = closing.length > 0 ? closing[0].status : 'NOT_STARTED';
    const cashDiff = closing.reduce((s, r) => s + Number(r.cash_difference || 0), 0);

    const waste = wasteRows.filter((r) => r.date === date && r.outlet_id === outletId);
    const wasteQty = waste.reduce((s, r) => s + Number(r.qty || 0), 0);
    const wasteValue = waste.reduce((s, r) => s + Number(r.estimated_total_value || 0), 0);

    const stockIssues = stockRows.filter((r) => r.date === date && r.outlet_id === outletId);

    const staffBrief = briefingRows.filter((r) => r.date === date && r.outlet_id === outletId);
    const scheduledStaff = 2; // seed baseline; later derived from roster
    const actualStaff = staffBrief.length > 0 ? Number(staffBrief[0].staffing_warning || 0) + scheduledStaff : scheduledStaff;
    const shortage = Math.max(0, scheduledStaff - actualStaff);

    const issues: string[] = [];
    if (openCritical > 0) issues.push(`${openCritical} opening critical`);
    if (overSla > 0) issues.push(`${overSla} order over SLA`);
    if (highIncident > 0) issues.push(`${highIncident} high incident`);
    if (Math.abs(cashDiff) >= 50000) issues.push(`cash diff ${formatIdr(cashDiff)}`);
    if (wasteValue >= 200000) issues.push(`waste ${formatIdr(wasteValue)}`);
    const majorIssue = issues.join('; ') || 'Operasional normal';
    const recommendedAction = issues.length
      ? 'Tindak lanjut PIC outlet segera: cek opening, KDS, cashier closing.'
      : 'Pertahankan performa shift.';

    const existing = await findRow(TABS.summary, 'summary_id', `${outletId}-${date}`);
    const row = {
      summary_id: existing?.row.summary_id ?? `${outletId}-${date}`,
      date,
      brand_id: brandId,
      brand_name: brandName,
      outlet_id: outletId,
      outlet_name: outletName,
      opening_status: openTotal > 0 ? (openPct >= 95 ? 'READY' : 'NEEDS_REVIEW') : 'NOT_STARTED',
      opening_completion_percentage: String(openPct),
      critical_opening_issue: String(openCritical),
      scheduled_staff: String(scheduledStaff),
      actual_staff: String(actualStaff),
      shift_shortage: String(shortage),
      total_orders: String(totalOrders),
      avg_serving_time: String(avgServe),
      orders_over_sla: String(overSla),
      critical_delay_count: String(criticalDelay),
      avg_qc_score: String(avgQc),
      qc_fail_count: String(qcFail),
      incident_count: String(incidentCount),
      high_severity_incident: String(highIncident),
      complaint_count: String(complaintCount),
      waste_qty: String(wasteQty),
      waste_value: String(wasteValue),
      stock_issue_count: String(stockIssues.length),
      closing_status: closingStatus,
      cash_difference: String(cashDiff),
      open_action_count: String(openActions),
      major_ops_issue: majorIssue,
      recommended_action: recommendedAction,
      created_at: existing?.row.created_at ?? new Date().toISOString().replace('T', ' ').slice(0, 19),
    };

    if (existing) {
      await updateRow(TABS.summary, existing.rowIndex, row);
    } else {
      row.summary_id = nextSequentialIdSync('SUM');
      await appendRows(TABS.summary, [row]);
    }
    summaries.push(row);
  }

  return summaries;
}
