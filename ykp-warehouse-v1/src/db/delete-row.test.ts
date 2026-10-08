import { beforeAll, describe, expect, it } from 'vitest';
import { appendRows, deleteRow, findRow, readTab, TABS } from '@/db/sheets';

beforeAll(() => {
  process.env.USE_MOCK_DB = 'true';
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.YKP_WAREHOUSE_SPREADSHEET_ID;
});

describe('warehouse deleteRow', () => {
  it('removes one item row and keeps the rest intact', async () => {
    await appendRows(TABS.items, [
      { item_id: 'ITM-DEL-A', item_name: 'A' },
      { item_id: 'ITM-DEL-B', item_name: 'B' },
      { item_id: 'ITM-DEL-C', item_name: 'C' }
    ]);
    const target = await findRow(TABS.items, 'item_id', 'ITM-DEL-B');
    await deleteRow(TABS.items, target!.rowNumber);
    const ids = (await readTab<Record<string, string>>(TABS.items)).filter((r) => r.item_id?.startsWith('ITM-DEL-')).map((r) => r.item_id);
    expect(ids).toEqual(['ITM-DEL-A', 'ITM-DEL-C']);
    expect(await findRow(TABS.items, 'item_id', 'ITM-DEL-B')).toBeNull();
  });
});
