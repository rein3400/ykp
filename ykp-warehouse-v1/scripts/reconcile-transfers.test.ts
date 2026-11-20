import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ tabs: {} as Record<string, string[][]>, appended: [] as string[][] }));
vi.mock('googleapis', () => ({ google: {
  auth: { JWT: class {} },
  sheets: () => ({ spreadsheets: { values: {
    get: async ({ range }: { range: string }) => ({ data: { values: state.tabs[range.split("'")[1]] ?? [] } }),
    append: async ({ requestBody }: { requestBody: { values: string[][] } }) => { state.appended.push(...requestBody.values); },
  } } }),
} }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('YKP_WAREHOUSE_SPREADSHEET_ID', 'TEST');
  vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('SCRIPT_EXIT'); });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'script', '--apply']);
  state.tabs = {};
  state.appended = [];
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

const headers = ['reference_type', 'reference_id', 'movement_type', 'item_id', 'location_id', 'base_unit', 'stock_after', 'movement_datetime', 'quantity'];
const seed = () => {
  state.tabs.warehouse_stock_movement = [headers, ['opening', 'OP1', 'OPENING', 'I1', 'SOURCE', 'g', '10', '2026-11-01 00:00:00', '10']];
  state.tabs.warehouse_transfer = [
    ['transfer_id', 'status', 'source_location_id', 'destination_location_id'],
    ['T1', 'RECEIVED', 'SOURCE', 'DEST'],
  ];
  state.tabs.warehouse_transfer_item = [
    ['transfer_item_id', 'transfer_id', 'item_id', 'dispatched_qty', 'received_qty', 'unit'],
    ['L1', 'T1', 'I1', '7', '7', 'g'],
    ['L2', 'T1', 'I1', '7', '7', 'g'],
  ];
};
const run = async () => {
  try { await import('./reconcile-transfers.mjs'); }
  catch (error) { if (!(error instanceof Error) || error.message !== 'SCRIPT_EXIT') throw error; }
};

describe('transfer reconciliation safety', () => {
  it('never spends the same source balance twice in one apply', async () => {
    seed();
    await run();
    const quantityIndex = headers.indexOf('quantity');
    expect(state.appended.reduce((total, row) => total + Number(row[quantityIndex]), 0)).toBeLessThanOrEqual(10);
  });
  it('does not credit incoming stock against a mismatched source posting', async () => {
    seed();
    state.tabs.warehouse_transfer_item.pop();
    state.tabs.warehouse_stock_movement.push(['transfer', 'T1', 'TRANSFER_OUT', 'I1', 'SOURCE', 'g', '8', '2026-11-02 00:00:00', '2']);
    await run();
    expect(state.appended).toHaveLength(0);
  });
  it('does not reuse a legacy OUT for two same-item destination legs', async () => {
    seed();
    state.tabs.warehouse_stock_movement.push(['transfer', 'T1', 'TRANSFER_OUT', 'I1', 'SOURCE', 'g', '3', '2026-11-02 00:00:00', '7']);
    await run();
    expect(state.appended).toHaveLength(0);
  });
});
