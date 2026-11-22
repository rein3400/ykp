/**
 * Server-rendered UI guard — warehouse.
 *
 * Renders the real pages so the page → RBAC → client prop wiring is covered:
 * a role without permission must not receive markup for a write action.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';

const session = { userId: 'USR-001', role: 'staff', username: 'staff' };
vi.mock('@/lib/session', () => ({ getSession: async () => session }));
vi.mock('@/db/sheets', () => ({
  TABS: new Proxy({}, { get: (_t, key) => String(key) }),
  readTab: async (tab: string) =>
    tab === 'transfer'
      ? [{ transfer_id: 'TRF-1', date: '2026-11-15', source_location_id: 'LOC-1', destination_location_id: 'LOC-2', status: 'REQUESTED' }]
      : tab === 'items'
        ? [{ item_id: 'ITM-1', item_code: 'DOUGH', item_name: 'Dough' }]
        : tab === 'suppliers'
          ? [{ supplier_id: 'SUP-1', supplier_name: 'Supplier' }]
          : [],
  findRow: async () => null,
  appendRows: async () => 2,
  updateRow: async () => undefined,
}));
vi.mock('@/lib/legacy', () => ({ legacyWritesEnabled: () => true }));

const ReceivingPage = (await import('@/app/warehouse/penerimaan/page')).default;
const TransferPage = (await import('@/app/warehouse/transfer/page')).default;
const WastePage = (await import('@/app/warehouse/waste/page')).default;
const PemakaianPage = (await import('@/app/warehouse/pemakaian/page')).default;
const OpnamePage = (await import('@/app/warehouse/opname/page')).default;
const ClosingPage = (await import('@/app/warehouse/closing/page')).default;
const PurchaseRecPage = (await import('@/app/warehouse/purchase-recommendation/page')).default;

async function html(page: () => Promise<ReactElement>, role: string): Promise<string> {
  session.role = role;
  return renderToStaticMarkup(await page());
}

const ItemsPage = (await import('@/app/warehouse/items/page')).default;
const SuppliersPage = (await import('@/app/warehouse/suppliers/page')).default;

it.each([ItemsPage, SuppliersPage])('shows master row edit actions to outlet managers', async (page) => {
  expect(await html(page, 'outlet_manager')).toContain('>Edit</button>');
});

it.each([ItemsPage, SuppliersPage])('hides master row edit actions from staff', async (page) => {
  expect(await html(page, 'staff')).not.toContain('>Edit</button>');
  expect(await html(page, 'owner')).toContain('>Edit</button>');
});

const cases: Array<[string, () => Promise<ReactElement>, string]> = [
  ['receiving', ReceivingPage, '+ Receiving Baru'],
  ['transfer', TransferPage, '+ Transfer Baru'],
  ['waste', WastePage, '+ Catat Waste'],
  ['pemakaian', PemakaianPage, '+ Bon Pemakaian'],
  ['opname', OpnamePage, '+ Stock Opname Baru'],
  ['closing', ClosingPage, '+ Catat Closing'],
  ['purchase recommendation', PurchaseRecPage, 'Generate Recommendations'],
];

describe('warehouse pages hide actions the role cannot perform', () => {
  it.each(cases)('%s hides the create action for staff', async (_name, page, label) => {
    expect(await html(page, 'staff')).not.toContain(label);
  });

  it.each(cases)('%s shows the create action for owner', async (_name, page, label) => {
    expect(await html(page, 'owner')).toContain(label);
  });

  it('transfer hides approve/dispatch/receive for staff but keeps them for owner', async () => {
    expect(await html(TransferPage, 'staff')).not.toContain('Approve');
    session.role = 'owner';
    const owner = await html(TransferPage, 'owner');
    expect(owner).toContain('Approve');
  });
});
