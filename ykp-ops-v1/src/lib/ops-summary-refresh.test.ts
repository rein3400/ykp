import { beforeEach, describe, expect, it, vi } from 'vitest';

const db: Record<string, Record<string, string>[]> = {};

vi.mock('@/db/sheets', () => ({
  TABS: new Proxy({}, { get: (_t, key) => String(key) }),
  readTab: async (tab: string) => db[tab] ?? (db[tab] = []),
  appendRows: async (tab: string, rows: Record<string, string>[]) => {
    (db[tab] ??= []).push(...rows);
    return 2;
  },
  updateRow: async (tab: string, rowNumber: number, row: Record<string, string>) => {
    (db[tab] ??= [])[rowNumber - 2] = row;
  },
}));
vi.mock('@/lib/repo', () => ({
  getBrandName: async () => 'Brand',
  getOutletName: async () => 'Outlet',
}));

const { ensureDailySummary, summaryIsStale } = await import('@/lib/ops-summary');

beforeEach(() => {
  for (const key of Object.keys(db)) delete db[key];
  db.outlets = [
    { outlet_id: 'OL-1', brand_id: 'BR-1', status: 'active' },
  ];
});

describe('summaryIsStale', () => {
  it('treats a missing summary as stale', () => {
    expect(summaryIsStale('', '2026-11-15 08:00:00')).toBe(true);
  });

  it('is fresh when the summary was built after the latest activity', () => {
    expect(summaryIsStale('2026-11-15 09:00:00', '2026-11-15 08:59:00')).toBe(false);
  });

  it('is stale when staff activity landed after the build', () => {
    expect(summaryIsStale('2026-11-15 09:00:00', '2026-11-15 23:26:51')).toBe(true);
  });

  it('honours the max age window', () => {
    const built = '2026-11-15 09:00:00';
    const builtMs = Date.parse(`${built.replace(' ', 'T')}+07:00`);
    expect(summaryIsStale(built, built, builtMs + 60_000, 30_000)).toBe(true);
  });
});

describe('ensureDailySummary', () => {
  it('preserves existing AI insight when refreshing a summary', async () => {
    db.summary = [{ summary_id: 'OL-1-2026-11-15', date: '2026-11-15', outlet_id: 'OL-1', brand_id: 'BR-1', created_at: '', ai_insight: 'Follow up kitchen', ai_insight_generated_at: '2026-11-15 07:00:00' }];
    const rows = await ensureDailySummary({ date: '2026-11-15' });
    expect(rows[0].ai_insight).toBe('Follow up kitchen');
  });
  it('builds missing outlets even when another outlet has a fresh summary', async () => {
    db.outlets.push({ outlet_id: 'OL-2', brand_id: 'BR-1', status: 'active' });
    db.summary = [{ summary_id: 'OL-1-2026-11-15', date: '2026-11-15', outlet_id: 'OL-1', brand_id: 'BR-1', created_at: '2099-11-15 23:59:00' }];
    const rows = await ensureDailySummary({ date: '2026-11-15' });
    expect(rows.some(row => row.outlet_id === 'OL-2')).toBe(true);
  });
  it('uses department-aware opening submissions instead of lossy legacy rows', async () => {
    db.checklistTemplates = [
      { checklist_type: 'OPENING', checklist_item: 'Absen', department: 'Kasir', active_status: 'active' },
      { checklist_type: 'OPENING', checklist_item: 'Absen', department: 'Kitchen', active_status: 'active' },
    ];
    db.opening = [{ date: '2026-11-15', outlet_id: 'OL-1', brand_id: 'BR-1', shift_id: 'S1', checklist_item: 'Absen', status: 'DONE' }];
    db.checklistSubmissions = [{ date: '2026-11-15', outlet_id: 'OL-1', brand_id: 'BR-1', shift_id: 'S1', checklist_type: 'OPENING', checklist_item: 'Absen', department: 'Kasir', status: 'DONE' }];
    const rows = await ensureDailySummary({ date: '2026-11-15' });
    expect(rows[0].opening_completion_percentage).toBe('50');
  });

  it('builds the row when the dashboard has no summary yet', async () => {
    db.opening = [
      { date: '2026-11-15', outlet_id: 'OL-1', brand_id: 'BR-1', status: 'DONE', completed_at: '2026-11-15 07:50:00' },
    ];
    const rows = await ensureDailySummary({ date: '2026-11-15' });
    const scope = rows.filter((r) => r.date === '2026-11-15' && r.outlet_id === 'OL-1');
    expect(scope).toHaveLength(1);
    expect(Number(scope[0].opening_completion_percentage)).toBeGreaterThan(0);
  });

  it('does not rebuild when nothing changed since the last build', async () => {
    db.summary = [
      { summary_id: 'OL-1-2026-11-15', date: '2026-11-15', outlet_id: 'OL-1', brand_id: 'BR-1', created_at: '2026-11-15 23:59:00' },
    ];
    db.opening = [
      { date: '2026-11-15', outlet_id: 'OL-1', brand_id: 'BR-1', status: 'DONE', completed_at: '2026-11-15 07:50:00' },
    ];
    await ensureDailySummary({ date: '2026-11-15' });
    expect(db.summary).toHaveLength(1);
  });
});
