/**
 * Sheet repository helpers. FK validation, ID generation, common lookups.
 * Sheets has no FK so we validate here and throw MissingRefError.
 *
 * Expanded for Warehouse V1: location, supplier, category, threshold validations.
 */
import { randomBytes } from 'crypto';
import { readTab, TABS, findRow } from '@/db/sheets';
import { nowTimestampWib } from './format';

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

export async function assertItem(itemId: string): Promise<void> {
  if (!itemId) throw new MissingRefError('item_id is required');
  const r = await findRow(TABS.items, 'item_id', itemId);
  if (!r) throw new MissingRefError(`item_id not found: ${itemId}`);
}

export async function assertLocation(locationId: string): Promise<void> {
  if (!locationId) throw new MissingRefError('location_id is required');
  const r = await findRow(TABS.locations, 'location_id', locationId);
  if (!r) throw new MissingRefError(`location_id not found: ${locationId}`);
}

export async function assertSupplier(supplierId: string): Promise<void> {
  if (!supplierId) throw new MissingRefError('supplier_id is required');
  const r = await findRow(TABS.suppliers, 'supplier_id', supplierId);
  if (!r) throw new MissingRefError(`supplier_id not found: ${supplierId}`);
}

export async function assertCategory(categoryId: string): Promise<void> {
  if (!categoryId) throw new MissingRefError('category_id is required');
  const r = await findRow(TABS.itemCategory, 'category_id', categoryId);
  if (!r) throw new MissingRefError(`category_id not found: ${categoryId}`);
}

/** Race-free unique ID: PREFIX-{ts36}{rand6}. */
export function nextSequentialIdSync(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}${rand}`;
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
