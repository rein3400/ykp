import { describe, it, expect, beforeEach } from 'vitest';
import { mockReset } from '../db/mock-store';
import { generateDailySummary } from './ops-summary';
import { appendRows, TABS } from '../db/sheets';
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
});
