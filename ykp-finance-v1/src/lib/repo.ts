/**
 * Sheet repository helpers. FK validation, ID generation, common lookups.
 * Sheets has no FK so we validate here and throw MissingRefError.
 */
import { readTab, TABS, findRow } from '@/db/sheets';
import { nowTimestampWib } from './format';

export { nextSequentialIdSync } from './id-gen';

export class MissingRefError extends Error {
  override name = 'MissingRefError';
  constructor(message: string) { super(message); }
}

export class ConflictError extends Error {
  override name = 'ConflictError';
  constructor(message: string) { super(message); }
}

export class NotFoundError extends Error {
  override name = 'NotFoundError';
  constructor(message: string) { super(message); }
}

export async function assertBrand(brandId: string): Promise<void> {
  if (!brandId) throw new MissingRefError('brand_id is required');
  const r = await findRow(TABS.brands, 'brand_id', brandId);
  if (!r) throw new MissingRefError(`brand_id not found: ${brandId}`);
}

export async function assertOutlet(outletId: string): Promise<void> {
  if (!outletId) throw new MissingRefError('outlet_id is required');
  const r = await findRow(TABS.outlets, 'outlet_id', outletId);
  if (!r) throw new MissingRefError(`outlet_id not found: ${outletId}`);
}

export async function assertSupplier(supplierId: string): Promise<void> {
  if (!supplierId) throw new MissingRefError('supplier_id is required');
  const r = await findRow(TABS.suppliers, 'supplier_id', supplierId);
  if (!r) throw new MissingRefError(`supplier_id not found: ${supplierId}`);
}

export async function assertExpenseCategory(categoryName: string): Promise<void> {
  if (!categoryName) throw new MissingRefError('expense_category is required');
  const rows = await readTab<Record<string, string>>(TABS.expenseCategories);
  if (!rows.some((r) => r.category_name === categoryName)) {
    throw new MissingRefError(`expense_category not found: ${categoryName}`);
  }
}

export async function assertPettyCashAccount(accountId: string): Promise<void> {
  if (!accountId) throw new MissingRefError('account_id is required');
  const r = await findRow(TABS.pettyCashAccounts, 'account_id', accountId);
  if (!r) throw new MissingRefError(`account_id not found: ${accountId}`);
}

/** Scan tab for highest existing PREFIX-NNN. Returns next number. */
export async function nextNumericSeq(tab: keyof typeof TABS, keyCol: string, prefix: string): Promise<number> {
  const rows = await readTab<Record<string, string>>(TABS[tab]);
  let maxN = 0;
  for (const r of rows) {
    const v = r[keyCol] ?? '';
    const m = v.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) {
      const n = Number(m[1]);
      if (n > maxN) maxN = n;
    }
  }
  return maxN + 1;
}

export async function nextSequentialId(
  tab: keyof typeof TABS,
  keyCol: string,
  prefix: string,
  digits = 3
): Promise<string> {
  const n = await nextNumericSeq(tab, keyCol, prefix);
  return `${prefix}-${String(n).padStart(digits, '0')}`;
}

export function nowCreated(): string {
  return nowTimestampWib();
}

export { readTab, TABS, findRow };
