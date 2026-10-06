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

  it('does not generate operational summaries for inactive outlets', async () => {
    await appendRows(TABS.outlets, [{ outlet_id: 'OL-CLOSED', outlet_name: 'Closed', brand_id: 'BR-001', status: 'inactive' }]);
    const items = await generateDailySummary({ date: todayWib() });
    expect(items.some((item) => item.outlet_id === 'OL-CLOSED')).toBe(false);
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

  it('regenerate is idempotent — no duplicate rows (F1 regression)', async () => {
    const date = todayWib();
    await generateDailySummary({ date });
    await generateDailySummary({ date });
    await generateDailySummary({ date });
    const rows = await readTab(TABS.summary);
    const forDate = rows.filter((r) => r.date === date && r.outlet_id === 'OL-001');
    expect(forDate).toHaveLength(1);
  });

  it('stable summary_id keyed on outlet+date (F1)', async () => {
    const date = todayWib();
    const [item] = await generateDailySummary({ date });
    expect(item.summary_id).toBe('OL-001-' + date);
  });

  it('RESOLVED/CLOSED incidents do not count as open actions (F2)', async () => {
    const date = todayWib();
    await appendRows(TABS.incidents, [
      { incident_id: 'INC-A', date, outlet_id: 'OL-001', status: 'OPEN', severity: 'MEDIUM', incident_type: 'OPERATIONAL', title: 'a', created_at: date },
      { incident_id: 'INC-B', date, outlet_id: 'OL-001', status: 'RESOLVED', severity: 'MEDIUM', incident_type: 'OPERATIONAL', title: 'b', resolved_at: date, created_at: date },
      { incident_id: 'INC-C', date, outlet_id: 'OL-001', status: 'CLOSED', severity: 'LOW', incident_type: 'OPERATIONAL', title: 'c', resolved_at: date, created_at: date },
      { incident_id: 'INC-D', date, outlet_id: 'OL-001', status: 'INVESTIGATING', severity: 'LOW', incident_type: 'OPERATIONAL', title: 'd', created_at: date },
    ]);
    const [item] = await generateDailySummary({ date });
    expect(item.incident_count).toBe('4');
    expect(item.open_action_count).toBe('2');
  });

  it('legacy OPS-* row with same (outlet,date) is updated, not duplicated (F1)', async () => {
    const date = todayWib();
    await appendRows(TABS.summary, [{
      summary_id: 'OPS-20260831-001', date, brand_id: 'BR-001', outlet_id: 'OL-001',
      outlet_name: 'Funkydak', incident_count: '5', created_at: date,
    }]);
    await generateDailySummary({ date });
    const rows = await readTab(TABS.summary);
    const forDate = rows.filter((r) => r.date === date && r.outlet_id === 'OL-001');
    expect(forDate).toHaveLength(1);
    expect(forDate[0].summary_id).toBe('OPS-20260831-001');
    expect(forDate[0].incident_count).toBe('0');
  });
});