import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ tabs: {} as Record<string, string[][]>, appended: [] as string[][] }));
vi.mock('googleapis', () => ({ google: {
  auth: { JWT: class {} }, sheets: () => ({ spreadsheets: { values: {
    get: async ({ range }: { range: string }) => ({ data: { values: state.tabs[range.split("'")[1]] ?? [] } }),
    append: async ({ requestBody }: { requestBody: { values: string[][] } }) => { state.appended.push(...requestBody.values); },
  } } }),
} }));
beforeEach(() => {
  vi.resetModules(); vi.stubEnv('YKP_WAREHOUSE_SPREADSHEET_ID', 'TEST');
  vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('SCRIPT_EXIT'); });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'script', '--apply']);
  state.appended = [];
  state.tabs = {
    warehouse_receiving: [['receiving_id', 'destination_location_id'], ['R1', 'LOC']],
    warehouse_receiving_item: [['receiving_id', 'receiving_item_id', 'item_id', 'qty_accepted', 'unit', 'unit_price'], ['R1', 'L1', 'I1', '500', 'g', '1']],
    master_item: [['item_id', 'base_unit'], ['I1', 'g']],
    master_unit_conversion: [[]],
    warehouse_stock_movement: [['reference_type', 'reference_id', 'item_id', 'location_id', 'base_unit', 'stock_after', 'movement_datetime', 'movement_type', 'direction', 'quantity'], ['opening', 'OP1', 'I1', 'LOC', 'g', '1000', '2026-11-01', 'OPENING', 'IN', '1000']],
  };
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const run = async () => {
  try { await import('./reconcile-receiving.mjs'); }
  catch (error) { if (!(error instanceof Error) || error.message !== 'SCRIPT_EXIT') throw error; }
};
describe('receiving reconciliation safety', () => {
  it('blocks mixed book units rather than adding grams to a kilogram balance', async () => {
    state.tabs.warehouse_stock_movement[1][4] = 'kg';
    await run(); expect(state.appended).toHaveLength(0);
  });
  it('blocks ambiguous legacy postings for repeated item lines', async () => {
    state.tabs.warehouse_receiving_item.push(['R1', 'L2', 'I1', '200', 'g', '1']);
    state.tabs.warehouse_stock_movement.push(['receiving', 'R1-I1', 'I1', 'LOC', 'g', '1500', '2026-11-02', 'RECEIPT', 'IN', '500']);
    await run(); expect(state.appended).toHaveLength(0);
  });
  it('posts an unambiguous missing line in matching base units', async () => {
    await run(); expect(state.appended).toHaveLength(1);
  });
});
