import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HrOverview from './page';
import { TABS } from '@/db/sheets';

const state = vi.hoisted(() => ({
  failed: new Set<string>(),
  rows: {} as Record<string, Record<string, string>[]>,
  props: {} as Record<string, unknown>,
  role: 'owner',
  calls: [] as string[]
}));
vi.mock('@/db/sheets', async (original) => ({
  ...await original<typeof import('@/db/sheets')>(),
  readTab: async (tab: string) => {
    state.calls.push(tab);
    if (state.failed.has(tab)) throw new Error('SYNTHETIC_PRIVATE_DATABASE_DETAIL');
    return state.rows[tab] ?? [];
  }
}));
vi.mock('@/lib/session', () => ({
  getSession: async () => ({ userId: 'USR-TEST', role: state.role, outletId: 'OL-1', brandId: 'BR-1' })
}));
vi.mock('@/features/hr/components/hr-overview-client', () => ({
  HrOverviewClient: (props: Record<string, unknown>) => { state.props = props; return null; }
}));

beforeEach(() => {
  state.failed.clear(); state.props = {}; state.calls = []; state.role = 'owner';
  state.rows = {
    [TABS.employees]: [
      { employee_id: 'EMP-1', full_name: 'Fixture One', outlet_id: 'OL-1', brand_id: 'BR-1', active_status: 'active' },
      { employee_id: 'EMP-2', full_name: 'Fixture Two', outlet_id: 'OL-2', brand_id: 'BR-2', active_status: 'active' }
    ],
    [TABS.outlets]: [{ outlet_id: 'OL-1', brand_id: 'BR-1', outlet_name: 'Fixture Outlet' }],
    [TABS.brands]: [{ brand_id: 'BR-1', brand_name: 'Fixture Brand' }]
  };
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

/** Render the actual async server component, stubbing only its I/O and client leaf. */
async function renderOverview(): Promise<string> {
  const output = HrOverview();
  await expect(output).resolves.toBeDefined();
  return renderToStaticMarkup(await output);
}

describe('HR overview partial data reads', () => {
  it('renders healthy data without a degradation warning', async () => {
    expect(await renderOverview()).not.toContain('Sebagian data gagal dimuat');
    expect(state.props.employees).toHaveLength(2);
    expect(state.calls).toHaveLength(7);
  });

  it('keeps the page and other data available if one tab fails', async () => {
    state.failed.add(TABS.brands);
    const html = await renderOverview();
    expect(html).toContain('HR Overview');
    expect(html).toContain('Sebagian data gagal dimuat');
    expect(html).toContain(TABS.brands);
    expect(state.props.brands).toEqual([]);
    expect(state.props.employees).toHaveLength(2);
    expect(html).not.toContain('SYNTHETIC_PRIVATE_DATABASE_DETAIL');
    expect(vi.mocked(console.error).mock.calls.flat().map(String).join(' ')).not.toContain('SYNTHETIC_PRIVATE_DATABASE_DETAIL');
  });

  it('shows explicit partial-data warning when all seven tabs fail', async () => {
    [TABS.employees, TABS.attendance, TABS.leaves, TABS.roster, TABS.brands, TABS.outlets, TABS.dailySummary].forEach((tab) => state.failed.add(tab));
    const html = await renderOverview();
    expect(html).toContain('Sebagian data gagal dimuat');
    expect(state.props.employees).toEqual([]);
    expect(state.props.recentSummary).toEqual([]);
    expect(console.error).toHaveBeenCalledTimes(7);
  });

  it('retains outlet scoping when an unrelated tab fails', async () => {
    state.role = 'outlet_manager'; state.failed.add(TABS.attendance);
    await renderOverview();
    expect(state.props.employees).toEqual([state.rows[TABS.employees][0]]);
    expect(state.props.attendance).toEqual([]);
  });
});
