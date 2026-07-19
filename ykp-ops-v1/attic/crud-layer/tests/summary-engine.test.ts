import { describe, it, expect } from 'vitest';
import { buildDailySummary, summaryId, type SummaryInput } from '@/lib/summary-engine';
import type { AlertSpec } from '@/lib/alert-rules';

const alert = (type: string, severity: AlertSpec['severity'], title: string): AlertSpec => ({
  type, severity, title, message: title, referenceType: 'x', referenceId: 'y', actionRequired: `do ${type}`
});

const baseInput = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  date: '2026-07-13',
  brandId: 'BR-001',
  brandName: 'Funkydak',
  outletId: 'OL-001',
  outletName: 'Funkydak Cipete',
  opening: { hasChecklist: true, status: 'FAILED', completionPct: 94.1, criticalFailed: 1 },
  briefing: { scheduledStaff: 0, actualStaff: 0, staffingWarning: '1 kitchen shortage' },
  incidents: [
    { severity: 'HIGH', incident_type: 'EQUIPMENT_FAILURE' },
    { severity: 'CRITICAL', incident_type: 'FOOD_QUALITY' },
    { severity: 'MEDIUM', incident_type: 'CUSTOMER_COMPLAINT' }
  ],
  waste: { count: 3, totalQty: 5, totalValue: 166000 },
  closing: { approved: false, exists: true, cashDifference: 75000 },
  openActionCount: 5,
  alerts: [alert('OPENING_CRITICAL_FAILED', 'HIGH', '1 critical opening item FAILED'),
           alert('CASH_DIFFERENCE_OVER_TOLERANCE', 'HIGH', 'Selisih kas Rp 75.000 > toleransi')],
  ...over
});

describe('summaryId', () => {
  it('is deterministic per outlet+date', () => {
    expect(summaryId('OL-001', '2026-07-13')).toBe('SUM-OL-001-2026-07-13');
  });
});

describe('buildDailySummary', () => {
  it('produces all 30 columns of ops_daily_summary', () => {
    const row = buildDailySummary(baseInput(), '2026-07-13 22:00:00');
    expect(Object.keys(row)).toHaveLength(30);
    expect(row.summary_id).toBe('SUM-OL-001-2026-07-13');
    expect(row.opening_status).toBe('FAILED');
    expect(row.opening_completion_percentage).toBe('94.1');
    expect(row.critical_opening_issue).toBe('1');
  });
  it('counts incidents, high severity, complaints', () => {
    const row = buildDailySummary(baseInput(), 't');
    expect(row.incident_count).toBe('3');
    expect(row.high_severity_incident).toBe('2');
    expect(row.complaint_count).toBe('1');
  });
  it('maps staffing warning to shift_shortage', () => {
    expect(buildDailySummary(baseInput(), 't').shift_shortage).toBe('1');
    expect(buildDailySummary(baseInput({ briefing: null }), 't').shift_shortage).toBe('0');
  });
  it('closing status: APPROVED / PENDING / MISSING', () => {
    expect(buildDailySummary(baseInput({ closing: { approved: true, exists: true, cashDifference: 0 } }), 't').closing_status).toBe('APPROVED');
    expect(buildDailySummary(baseInput({ closing: { approved: false, exists: true, cashDifference: 75000 } }), 't').closing_status).toBe('PENDING');
    expect(buildDailySummary(baseInput({ closing: { approved: false, exists: false, cashDifference: null } }), 't').closing_status).toBe('MISSING');
  });
  it('major issue + recommended action come from HIGH/CRITICAL alerts only', () => {
    const row = buildDailySummary(baseInput({
      alerts: [
        alert('OPENING_COMPLETION_LOW', 'MEDIUM', 'minor'),
        alert('INCIDENT_CRITICAL', 'CRITICAL', '1 incident CRITICAL terbuka')
      ]
    }), 't');
    expect(row.major_ops_issue).toBe('1 incident CRITICAL terbuka');
    expect(row.recommended_action).toContain('Tangani incident CRITICAL segera');
  });
  it('KDS/QC columns are zeroed (V1.5 deferred)', () => {
    const row = buildDailySummary(baseInput(), 't');
    expect(row.total_orders).toBe('0');
    expect(row.avg_serving_time).toBe('0');
    expect(row.orders_over_sla).toBe('0');
    expect(row.avg_qc_score).toBe('0');
    expect(row.qc_fail_count).toBe('0');
  });
  it('no-checklist day ΓåÆ NOT_STARTED', () => {
    const row = buildDailySummary(baseInput({ opening: { hasChecklist: false, status: 'NOT_STARTED', completionPct: 0, criticalFailed: 0 } }), 't');
    expect(row.opening_status).toBe('NOT_STARTED');
  });
});
