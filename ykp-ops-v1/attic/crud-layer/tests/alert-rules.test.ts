import { describe, it, expect } from 'vitest';
import {
  evaluateOpsAlerts, alertId, actionId, requiresAction, isIncidentOverdue,
  DEFAULT_THRESHOLDS, type OpsContext
} from '@/lib/alert-rules';

const baseCtx = (over: Partial<OpsContext> = {}): OpsContext => ({
  date: '2026-07-13',
  outletId: 'OL-001',
  opening: { hasChecklist: false, completionPct: 0, criticalFailed: 0 },
  incidents: [],
  wasteValue: 0,
  repeatedWasteIngredients: [],
  cashDifference: null,
  closingApproved: true,
  actions: [],
  thresholds: { ...DEFAULT_THRESHOLDS, closingDeadlinePassed: false },
  ...over
});

describe('deterministic IDs', () => {
  it('alertId/actionId are stable and derived', () => {
    const id = alertId('OL-001', '2026-07-13', 'OPENING_COMPLETION_LOW');
    expect(id).toBe('ALR-OL-001-2026-07-13-OPENING_COMPLETION_LOW');
    expect(actionId(id)).toBe('ACT-ALR-OL-001-2026-07-13-OPENING_COMPLETION_LOW');
  });
  it('HIGH/CRITICAL require auto action', () => {
    expect(requiresAction('HIGH')).toBe(true);
    expect(requiresAction('CRITICAL')).toBe(true);
    expect(requiresAction('MEDIUM')).toBe(false);
    expect(requiresAction('LOW')).toBe(false);
  });
});

describe('opening rules', () => {
  it('completion <95% ΓåÆ MEDIUM alert', () => {
    const alerts = evaluateOpsAlerts(baseCtx({ opening: { hasChecklist: true, completionPct: 94.1, criticalFailed: 0 } }));
    const a = alerts.find((x) => x.type === 'OPENING_COMPLETION_LOW');
    expect(a?.severity).toBe('MEDIUM');
  });
  it('completion <90% ΓåÆ escalated HIGH', () => {
    const alerts = evaluateOpsAlerts(baseCtx({ opening: { hasChecklist: true, completionPct: 80, criticalFailed: 0 } }));
    expect(alerts.find((x) => x.type === 'OPENING_COMPLETION_LOW')?.severity).toBe('HIGH');
  });
  it('completion >=95% ΓåÆ no alert', () => {
    const alerts = evaluateOpsAlerts(baseCtx({ opening: { hasChecklist: true, completionPct: 96, criticalFailed: 0 } }));
    expect(alerts.find((x) => x.type === 'OPENING_COMPLETION_LOW')).toBeUndefined();
  });
  it('critical opening failed > 0 ΓåÆ HIGH', () => {
    const alerts = evaluateOpsAlerts(baseCtx({ opening: { hasChecklist: true, completionPct: 100, criticalFailed: 1 } }));
    const a = alerts.find((x) => x.type === 'OPENING_CRITICAL_FAILED');
    expect(a?.severity).toBe('HIGH');
  });
});

describe('incident rules', () => {
  it('open HIGH incident ΓåÆ HIGH alert; open CRITICAL ΓåÆ CRITICAL alert', () => {
    const alerts = evaluateOpsAlerts(baseCtx({
      incidents: [
        { severity: 'HIGH', status: 'OPEN', due_date: '2026-07-14', incident_type: 'EQUIPMENT_FAILURE' },
        { severity: 'CRITICAL', status: 'IN_PROGRESS', due_date: '2026-07-13', incident_type: 'FOOD_QUALITY' }
      ]
    }));
    expect(alerts.find((x) => x.type === 'INCIDENT_HIGH')?.severity).toBe('HIGH');
    expect(alerts.find((x) => x.type === 'INCIDENT_CRITICAL')?.severity).toBe('CRITICAL');
  });
  it('resolved incidents do not alert', () => {
    const alerts = evaluateOpsAlerts(baseCtx({
      incidents: [{ severity: 'CRITICAL', status: 'RESOLVED', due_date: '2026-07-12', incident_type: 'SAFETY' }]
    }));
    expect(alerts.find((x) => x.type === 'INCIDENT_CRITICAL')).toBeUndefined();
    expect(alerts.find((x) => x.type === 'INCIDENT_OVERDUE')).toBeUndefined();
  });
  it('open incident past deadline ΓåÆ OVERDUE HIGH', () => {
    const alerts = evaluateOpsAlerts(baseCtx({
      incidents: [{ severity: 'MEDIUM', status: 'OPEN', due_date: '2026-07-12', incident_type: 'HYGIENE' }]
    }));
    expect(alerts.find((x) => x.type === 'INCIDENT_OVERDUE')?.severity).toBe('HIGH');
  });
  it('isIncidentOverdue checks deadline vs date', () => {
    const i = { severity: 'LOW', status: 'OPEN', due_date: '2026-07-12', incident_type: 'OTHER' };
    expect(isIncidentOverdue(i, '2026-07-13')).toBe(true);
    expect(isIncidentOverdue(i, '2026-07-12')).toBe(false);
    expect(isIncidentOverdue({ ...i, status: 'RESOLVED' }, '2026-07-13')).toBe(false);
    expect(isIncidentOverdue({ ...i, due_date: '' }, '2026-07-13')).toBe(false);
  });
});

describe('waste rules', () => {
  it('waste over daily limit ΓåÆ HIGH', () => {
    const alerts = evaluateOpsAlerts(baseCtx({ wasteValue: 600000 }));
    expect(alerts.find((x) => x.type === 'WASTE_OVER_LIMIT')?.severity).toBe('HIGH');
  });
  it('waste at exactly the limit ΓåÆ no alert', () => {
    const alerts = evaluateOpsAlerts(baseCtx({ wasteValue: 500000 }));
    expect(alerts.find((x) => x.type === 'WASTE_OVER_LIMIT')).toBeUndefined();
  });
  it('repeated ingredient ΓåÆ REVIEW (MEDIUM)', () => {
    const alerts = evaluateOpsAlerts(baseCtx({ repeatedWasteIngredients: ['Ayam Fillet'] }));
    const a = alerts.find((x) => x.type === 'WASTE_REPEATED_ITEM');
    expect(a?.severity).toBe('MEDIUM');
    expect(a?.message).toContain('Ayam Fillet');
  });
});

describe('cash rule', () => {
  it('|diff| > Rp50.000 ΓåÆ HIGH', () => {
    const alerts = evaluateOpsAlerts(baseCtx({ cashDifference: 75000 }));
    const a = alerts.find((x) => x.type === 'CASH_DIFFERENCE_OVER_TOLERANCE');
    expect(a?.severity).toBe('HIGH');
  });
  it('negative diff beyond tolerance also alerts', () => {
    const alerts = evaluateOpsAlerts(baseCtx({ cashDifference: -60000 }));
    expect(alerts.find((x) => x.type === 'CASH_DIFFERENCE_OVER_TOLERANCE')).toBeDefined();
  });
  it('within tolerance ΓåÆ no alert; null (no recon) ΓåÆ no alert', () => {
    expect(evaluateOpsAlerts(baseCtx({ cashDifference: 50000 })).find((x) => x.type === 'CASH_DIFFERENCE_OVER_TOLERANCE')).toBeUndefined();
    expect(evaluateOpsAlerts(baseCtx({ cashDifference: null })).find((x) => x.type === 'CASH_DIFFERENCE_OVER_TOLERANCE')).toBeUndefined();
  });
});

describe('closing + action rules', () => {
  it('closing late & unapproved ΓåÆ MEDIUM', () => {
    const alerts = evaluateOpsAlerts(baseCtx({
      closingApproved: false,
      thresholds: { ...DEFAULT_THRESHOLDS, closingDeadlinePassed: true }
    }));
    expect(alerts.find((x) => x.type === 'CLOSING_INCOMPLETE')?.severity).toBe('MEDIUM');
  });
  it('approved closing ΓåÆ no alert', () => {
    const alerts = evaluateOpsAlerts(baseCtx({
      closingApproved: true,
      thresholds: { ...DEFAULT_THRESHOLDS, closingDeadlinePassed: true }
    }));
    expect(alerts.find((x) => x.type === 'CLOSING_INCOMPLETE')).toBeUndefined();
  });
  it('open action past due ΓåÆ HIGH', () => {
    const alerts = evaluateOpsAlerts(baseCtx({
      actions: [{ status: 'OPEN', due_date: '2026-07-12' }]
    }));
    expect(alerts.find((x) => x.type === 'ACTION_OVERDUE')?.severity).toBe('HIGH');
  });
  it('done or undated actions ΓåÆ no alert', () => {
    expect(evaluateOpsAlerts(baseCtx({ actions: [{ status: 'DONE', due_date: '2026-07-12' }] }))
      .find((x) => x.type === 'ACTION_OVERDUE')).toBeUndefined();
    expect(evaluateOpsAlerts(baseCtx({ actions: [{ status: 'OPEN', due_date: '' }] }))
      .find((x) => x.type === 'ACTION_OVERDUE')).toBeUndefined();
  });
});

describe('combined scenario (mock demo day)', () => {
  it('produces the full expected alert set', () => {
    const alerts = evaluateOpsAlerts(baseCtx({
      opening: { hasChecklist: true, completionPct: 94.1, criticalFailed: 1 },
      incidents: [
        { severity: 'HIGH', status: 'OPEN', due_date: '2026-07-12', incident_type: 'EQUIPMENT_FAILURE' },
        { severity: 'CRITICAL', status: 'IN_PROGRESS', due_date: '2026-07-13', incident_type: 'FOOD_QUALITY' }
      ],
      wasteValue: 166000,
      repeatedWasteIngredients: ['Ayam Fillet'],
      cashDifference: 75000,
      closingApproved: false,
      thresholds: { ...DEFAULT_THRESHOLDS, closingDeadlinePassed: false }
    }));
    const types = alerts.map((a) => a.type).sort();
    expect(types).toEqual([
      'CASH_DIFFERENCE_OVER_TOLERANCE',
      'INCIDENT_CRITICAL',
      'INCIDENT_HIGH',
      'INCIDENT_OVERDUE',
      'OPENING_COMPLETION_LOW',
      'OPENING_CRITICAL_FAILED',
      'WASTE_REPEATED_ITEM'
    ]);
    // HIGH/CRITICAL ones auto-create actions
    const withAction = alerts.filter((a) => requiresAction(a.severity)).map((a) => a.type).sort();
    expect(withAction).toEqual([
      'CASH_DIFFERENCE_OVER_TOLERANCE',
      'INCIDENT_CRITICAL',
      'INCIDENT_HIGH',
      'INCIDENT_OVERDUE',
      'OPENING_CRITICAL_FAILED'
    ]);
  });
});
