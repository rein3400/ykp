/**
 * Live self-check for moka-live-sync (task 5.4 smoke, local).
 * Skipped by default — run with real .env:
 *   cd ykp-finance-v1 && MOKA_LIVE=1 npx vitest run tests/moka-live.test.ts
 * Issues REAL Moka API calls (token + reports) and writes into the in-memory
 * mock Sheets store. No real spreadsheet is touched.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env (MOKA_*, SESSION_SECRET) into process.env — vitest doesn't do it.
const envPath = resolve(__dirname, '../.env');
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*(MOKA_[A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // no .env → tests below will skip
}

const outletKeys = (process.env.MOKA_OUTLETS ?? '').split(',').map((k) => k.trim()).filter(Boolean);
const liveRun = process.env.MOKA_LIVE === '1' && outletKeys.length > 0;

// Mock Sheets (same shape as the real module; in-memory, discarded after run).
const sheetStore: Record<string, Record<string, string>[]> = {};
vi.mock('../src/db/sheets', () => ({
  TABS: {
    outlets: 'master_outlet',
    brands: 'master_brand',
    posDaily: 'fin_pos_daily',
    posItems: 'fin_pos_items',
    appSettings: 'app_settings'
  },
  readTab: vi.fn(async (tab: string) => sheetStore[tab] ?? []),
  appendRows: vi.fn(async (tab: string, rows: Record<string, string>[]) => {
    sheetStore[tab] = [...(sheetStore[tab] ?? []), ...rows];
    return (sheetStore[tab]?.length ?? 0) + 1;
  }),
  updateRow: vi.fn(async (tab: string, rowNumber: number, values: Record<string, string>) => {
    const arr = sheetStore[tab] ?? [];
    if (arr[rowNumber - 2]) Object.assign(arr[rowNumber - 2], values);
  }),
  findRow: vi.fn(async (tab: string, keyCol: string, value: string) => {
    const arr = sheetStore[tab] ?? [];
    const idx = arr.findIndex((r) => r[keyCol] === value);
    return idx >= 0 ? { rowNumber: idx + 2, row: arr[idx] } : null;
  })
}));

import { runMokaSync } from '../src/lib/moka-sync';
import { parseOutletKeys } from '../src/lib/moka-client';

describe.skipIf(!liveRun)('moka LIVE run (real API, mock Sheets)', () => {
  beforeAll(async () => {
    const { configured } = parseOutletKeys();
    // Test mapping: OL-LIVE-<mokaOutletId> so rows are identifiable and no
    // real OL-NNN is required.
    const map: Record<string, string> = {};
    for (const cfg of configured) map[cfg.mokaOutletId] = `OL-LIVE-${cfg.mokaOutletId}`;
    sheetStore['app_settings'] = [
      { setting_key: 'moka_outlet_map', setting_value: JSON.stringify(map), description: '', updated_by: 'live-test', updated_at: '' }
    ];
  });

  it('syncs one real day for all configured outlets', async () => {
    const date = process.env.MOKA_LIVE_DATE ?? '2026-09-08';
    const result = await runMokaSync({ date, actor: 'live-test' });
    console.log('RESULT:', JSON.stringify(result, null, 1));
    const daily = sheetStore['fin_pos_daily'] ?? [];
    const items = sheetStore['fin_pos_items'] ?? [];
    console.log(`fin_pos_daily: ${daily.length} baris | fin_pos_items: ${items.length} baris`);
    if (daily.length > 0) console.log('SAMPLE DAILY:', JSON.stringify(daily[0], null, 1).slice(0, 1200));
    if (items.length > 0) console.log('SAMPLE ITEM:', JSON.stringify(items[0]));
    for (const o of result.outlets) {
      expect(o.status).toBe('ok');
      expect(o.daily.written + o.daily.updated).toBeGreaterThan(0);
    }
    expect(daily.length).toBe(outletKeys.length);
    expect(items.length).toBeGreaterThan(0);
  }, 120_000);
});