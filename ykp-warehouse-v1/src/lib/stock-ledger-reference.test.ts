import { describe, expect, it, vi, beforeEach } from 'vitest';
import { appendRows, TABS } from '@/db/sheets';
import { appendMovement } from './stock-ledger';

beforeEach(async () => {
  process.env.USE_MOCK_DB = 'true';
  const rows = await import('@/db/sheets').then((mod) => mod.readTab<Record<string, string>>(mod.TABS.stockMovement));
  expect(Array.isArray(rows)).toBe(true);
});

async function seedBalance(itemId: string) {
  await appendMovement({
    movementType: 'OPENING_BALANCE', direction: 'IN', quantity: 10, baseUnit: 'kg', unitCost: 0,
    itemId, brandId: 'BR-1', outletId: 'OL-1', locationId: 'LOC-1',
    referenceType: 'opening', referenceId: `OPEN-${itemId}`, createdBy: 'U-1'
  });
}

describe('stock ledger reference uniqueness', () => {
  it('allows multiple legs that share a business reference (issue per line/leg)', async () => {
    const base = {
      movementType: 'ISSUE' as const, direction: 'OUT' as const, quantity: 1, baseUnit: 'kg', unitCost: 0,
      itemId: 'ITM-LEDGER-A', brandId: 'BR-1', outletId: 'OL-1', locationId: 'LOC-1',
      referenceType: 'stock_issue', createdBy: 'U-1'
    };
    await seedBalance('ITM-LEDGER-A');
    await appendMovement({ ...base, referenceId: 'ISU-TEST-1:line1:out' });
    await appendMovement({ ...base, referenceId: 'ISU-TEST-1:line1:in', direction: 'IN', locationId: 'LOC-2', movementType: 'TRANSFER_IN' });
    const rows = await import('@/db/sheets').then((mod) => mod.readTab<Record<string, string>>(mod.TABS.stockMovement));
    expect(rows.filter((row) => row.reference_id?.startsWith('ISU-TEST-1'))).toHaveLength(2);
  });
  it('still rejects an exact duplicate reference', async () => {
    const params = {
      movementType: 'ISSUE' as const, direction: 'OUT' as const, quantity: 1, baseUnit: 'kg', unitCost: 0,
      itemId: 'ITM-LEDGER-B', brandId: 'BR-1', outletId: 'OL-1', locationId: 'LOC-1',
      referenceType: 'stock_issue', referenceId: 'ISU-DUP-1:line1:out', createdBy: 'U-1'
    };
    await seedBalance('ITM-LEDGER-B');
    await appendMovement(params);
    await expect(appendMovement(params)).rejects.toThrow(/Duplicate reference/);
  });
});
