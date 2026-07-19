import { describe, it, expect } from 'vitest';
import { computeModuleStatus, latestSummaryDate } from './status';

describe('computeModuleStatus', () => {
  const today = '2026-03-04';

  it('returns mock regardless of other signals', () => {
    expect(computeModuleStatus({ mock: true, reachable: false, summaryDate: null, today })).toBe('mock');
    expect(computeModuleStatus({ mock: true, reachable: true, summaryDate: today, today })).toBe('mock');
  });

  it('returns offline when unreachable', () => {
    expect(computeModuleStatus({ mock: false, reachable: false, summaryDate: today, today })).toBe('offline');
    expect(computeModuleStatus({ mock: false, reachable: false, summaryDate: null, today })).toBe('offline');
  });

  it('returns fresh when the latest summary date is today', () => {
    expect(computeModuleStatus({ mock: false, reachable: true, summaryDate: today, today })).toBe('fresh');
  });

  it('returns stale when reachable but summary is old or missing', () => {
    expect(computeModuleStatus({ mock: false, reachable: true, summaryDate: '2026-03-03', today })).toBe('stale');
    expect(computeModuleStatus({ mock: false, reachable: true, summaryDate: null, today })).toBe('stale');
  });
});

describe('latestSummaryDate', () => {
  it('picks the max valid date', () => {
    expect(latestSummaryDate([
      { date: '2026-03-01' }, { date: '2026-03-04' }, { date: '2026-02-28' }
    ])).toBe('2026-03-04');
  });

  it('ignores malformed dates and empty rows', () => {
    expect(latestSummaryDate([{ date: 'tomorrow' }, {}, { date: '' }])).toBeNull();
    expect(latestSummaryDate([])).toBeNull();
  });
});
