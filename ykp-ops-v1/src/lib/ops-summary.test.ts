import { describe, it, expect, beforeEach } from 'vitest';
import { mockReset } from '../db/mock-store';
import { generateDailySummary } from './ops-summary';
import { appendRows, readTab, TABS } from '../db/sheets';
import { todayWib } from './format';

describe('ops-summary', () => {
  beforeEach(() => {
    process.env.USE_MOCK_DB = 'true';
    mockReset();
  });

  it('generates summary for active outlets', async () => {
    const date = todayWib();
    await appendRows(TABS.opening, [{
      opening_id: 'OPN-001', date, brand_id: 'BR-001', outlet_id: 'OL-001', shift_id: 'SH-001',
      checklist_item: 'Cek chiller', status: 'DONE', photo_url: '', notes: '',
      completed_by: 'USR-001', completed_at: date, critical_flag: 'true', created_at: date,
    }]);
    const items = await generateDailySummary({ date });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].outlet_id).toBe('OL-001');
    expect(Number(items[0].opening_completion_percentage)).toBe(100);
  });

  // Bug fix #1 (CRITICAL): regenerate must update-in-place, not append a
  // duplicate. The summary_id must be `${outletId}-${date}` so the findRow
  // idempotency lookup matches on the second run.
  it('regenerate updates in place (idempotent) — no duplicate summary row', async () => {
    const date = todayWib();
    await generateDailySummary({ date });
    const afterFirst = await readTab(TABS.summary);
    expect(afterFirst.length).toBe(1);
    expect(afterFirst[0].summary_id).toBe(`OL-001-${date}`);

    await generateDailySummary({ date });
    const afterSecond = await readTab(TABS.summary);
    expect(afterSecond.length).toBe(1);
    expect(afterSecond[0].summary_id).toBe(`OL-001-${date}`);
  });

  // Bug fix #4 (HIGH): staffing fields must not be fabricated from
  // staffing_warning free-text. With no roster data available, they are
  // emitted as empty strings.
  it('emits empty staffing fields (no fabricated headcount)', async () => {
    const date = todayWib();
    const items = await generateDailySummary({ date });
    expect(items[0].scheduled_staff).toBe('');
    expect(items[0].actual_staff).toBe('');
    expect(items[0].shift_shortage).toBe('');
  });
});
