import { randomBytes } from 'crypto';
import { readTab, findRow, TABS } from '@/db/sheets';
import { nowTimestampWib } from './format';

export class MissingRefError extends Error { override name = 'MissingRefError'; constructor(m: string) { super(m); } }
export class ConflictError extends Error { override name = 'ConflictError'; constructor(m: string) { super(m); } }

export async function assertInvestor(id: string): Promise<void> {
  if (!id) throw new MissingRefError('investor_id is required');
  const r = await findRow(TABS.investors, 'investor_id', id);
  if (!r) throw new MissingRefError(`investor_id not found: ${id}`);
}

export function nextSequentialIdSync(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}${rand}`;
}

export async function nextNumericSeq(tab: keyof typeof TABS, keyCol: string, prefix: string): Promise<number> {
  const rows = await readTab<Record<string, string>>(TABS[tab]);
  let maxN = 0;
  for (const r of rows) {
    const v = r[keyCol] ?? '';
    const m = v.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) { const n = Number(m[1]); if (n > maxN) maxN = n; }
  }
  return maxN + 1;
}

export async function nextSequentialId(tab: keyof typeof TABS, keyCol: string, prefix: string, digits = 3): Promise<string> {
  const n = await nextNumericSeq(tab, keyCol, prefix);
  return `${prefix}-${String(n).padStart(digits, '0')}`;
}

export function nowCreated(): string { return nowTimestampWib(); }
export { readTab, findRow, TABS };