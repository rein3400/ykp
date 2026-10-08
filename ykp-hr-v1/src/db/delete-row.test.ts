import { beforeAll, describe, expect, it } from 'vitest';
import { appendRows, deleteRow, findRow, readTab, TABS } from '@/db/sheets';

beforeAll(() => {
  process.env.USE_MOCK_DB = 'true';
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.YKP_HR_SPREADSHEET_ID;
});

describe('deleteRow (mock backend semantics)', () => {
  it('removes only the targeted row and keeps other rows resolvable', async () => {
    await appendRows(TABS.leaves, [
      { leave_id: 'DEL-A', employee_id: 'E1' },
      { leave_id: 'DEL-B', employee_id: 'E2' },
      { leave_id: 'DEL-C', employee_id: 'E3' }
    ]);
    const target = await findRow(TABS.leaves, 'leave_id', 'DEL-B');
    expect(target).not.toBeNull();
    await deleteRow(TABS.leaves, target!.rowNumber);
    const remaining = (await readTab<Record<string, string>>(TABS.leaves)).filter((row) => row.leave_id?.startsWith('DEL-'));
    expect(remaining.map((row) => row.leave_id)).toEqual(['DEL-A', 'DEL-C']);
    expect(await findRow(TABS.leaves, 'leave_id', 'DEL-B')).toBeNull();
    expect((await findRow(TABS.leaves, 'leave_id', 'DEL-C'))?.row.employee_id).toBe('E3');
  });

  it('rejects deleting a row that is not a data row', async () => {
    await expect(deleteRow(TABS.leaves, 1)).rejects.toThrow();
  });
});
