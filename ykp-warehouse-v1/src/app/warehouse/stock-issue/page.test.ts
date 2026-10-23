import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from './page';
vi.mock('@/lib/session', () => ({ getSession: async () => ({ role: 'outlet_manager', brandId: 'BR1', outletId: 'OL1' }) }));
vi.mock('@/db/sheets', async (original) => ({
  ...await original<typeof import('@/db/sheets')>(),
  readTab: async (tab: string) => tab === 'warehouse_stock_issue' ? [
    { issue_id: 'ISU1', brand_id: 'BR1', outlet_id: 'OL1', source_location_id: 'LOC1', approval_status: 'APPROVED' },
    { issue_id: 'ISU2', brand_id: 'BR2', outlet_id: 'OL2' }
  ] : tab === 'warehouse_stock_issue_item' ? [
    { issue_item_id: 'L1', issue_id: 'ISU1', item_id: 'ITM1', issued_qty: '2', unit: 'kg' }
  ] : []
}));
describe('structured stock issue page', () => {
  it('renders structured details within account scope and retains old history separately', async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('ISU1');
    expect(html).toContain('ITM1');
    expect(html).not.toContain('ISU2');
    expect(html).toContain('/warehouse/pemakaian');
    expect(html).not.toContain('mode legacy');
  });
});
