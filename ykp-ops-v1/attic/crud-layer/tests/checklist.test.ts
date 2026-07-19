import { describe, it, expect } from 'vitest';
import {
  completionPct, criticalFailedCount, issueCount, outletReadyStatus, completionAlertSeverity
} from '@/lib/checklist';

const item = (status: string, critical = 'NO') => ({ status, critical_flag: critical });

describe('completionPct', () => {
  it('returns 0 for empty list', () => {
    expect(completionPct([])).toBe(0);
  });
  it('counts everything except NOT_STARTED as completed', () => {
    const items = [item('OK'), item('ISSUE'), item('FAILED'), item('WAIVED'), item('REVIEWED'), item('NOT_STARTED')];
    expect(completionPct(items)).toBe(83.3);
  });
  it('is 100 when all done', () => {
    expect(completionPct([item('OK'), item('OK')])).toBe(100);
  });
  it('rounds to 1 decimal', () => {
    const items = [item('OK'), item('OK'), item('NOT_STARTED')];
    expect(completionPct(items)).toBe(66.7);
  });
});

describe('criticalFailedCount / issueCount', () => {
  it('counts only FAILED critical items', () => {
    const items = [item('FAILED', 'YES'), item('ISSUE', 'YES'), item('FAILED', 'NO'), item('OK', 'YES')];
    expect(criticalFailedCount(items)).toBe(1);
    expect(issueCount(items)).toBe(3);
  });
});

describe('outletReadyStatus', () => {
  it('NOT_STARTED for empty or untouched checklist', () => {
    expect(outletReadyStatus([])).toBe('NOT_STARTED');
    expect(outletReadyStatus([item('NOT_STARTED')])).toBe('NOT_STARTED');
  });
  it('FAILED when any critical item failed ΓÇö outlet cannot be READY', () => {
    const items = [item('OK'), item('FAILED', 'YES')];
    expect(outletReadyStatus(items)).toBe('FAILED');
    // even with completion >= 95%
    const many = Array.from({ length: 19 }, () => item('OK'));
    many.push(item('FAILED', 'YES'));
    expect(outletReadyStatus(many)).toBe('FAILED');
  });
  it('READY when completion >= 95% and no critical failure', () => {
    const items = [...Array.from({ length: 18 }, () => item('OK')), item('ISSUE'), item('OK')];
    expect(completionPct(items)).toBe(100);
    expect(outletReadyStatus(items)).toBe('READY');
  });
  it('CONDITIONAL for partial progress below threshold', () => {
    const items = [item('OK'), item('NOT_STARTED'), item('NOT_STARTED'), item('NOT_STARTED')];
    expect(outletReadyStatus(items)).toBe('CONDITIONAL');
  });
});

describe('completionAlertSeverity (brief: <95% MEDIUM, <90% WARNINGΓåÆHIGH)', () => {
  it('null at/above 95', () => {
    expect(completionAlertSeverity(95)).toBeNull();
    expect(completionAlertSeverity(100)).toBeNull();
  });
  it('MEDIUM between 90 and 95', () => {
    expect(completionAlertSeverity(94.1)).toBe('MEDIUM');
    expect(completionAlertSeverity(90)).toBe('MEDIUM');
  });
  it('HIGH below 90 (escalated warning)', () => {
    expect(completionAlertSeverity(89.9)).toBe('HIGH');
    expect(completionAlertSeverity(50)).toBe('HIGH');
  });
  it('respects custom thresholds', () => {
    expect(completionAlertSeverity(80, 70, 60)).toBeNull();
    expect(completionAlertSeverity(65, 70, 60)).toBe('MEDIUM');
    expect(completionAlertSeverity(59, 70, 60)).toBe('HIGH');
  });
});
