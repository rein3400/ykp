import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG } from '../src/config.js';
import { addRule, listRules, deleteRule, evaluateRules, type WatchRule } from '../src/watch.js';

// CONFIG.dataDir is fixed at module load (see vitest.config.ts env).
const dir = CONFIG.dataDir;

beforeEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function rule(over: Partial<WatchRule> = {}): Omit<WatchRule, 'id' | 'created_at'> {
  return {
    metric: 'sales_net_total',
    op: '<',
    threshold: 1000000,
    note: 'test rule',
    ...over,
  };
}

describe('watch rule CRUD', () => {
  it('addRule persists and listRules reads it back', async () => {
    const r = await addRule(rule());
    expect(r.id).toMatch(/^WR-/);
    const all = await listRules();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(r.id);
    expect(all[0].metric).toBe('sales_net_total');
  });

  it('deleteRule removes an existing rule and returns true', async () => {
    const r = await addRule(rule());
    expect(await deleteRule(r.id)).toBe(true);
    expect(await listRules()).toHaveLength(0);
  });

  it('deleteRule returns false for a missing id', async () => {
    await addRule(rule());
    expect(await deleteRule('WR-NOPE')).toBe(false);
    expect(await listRules()).toHaveLength(1);
  });
});

describe('evaluateRules', () => {
  it('returns empty when no rules', async () => {
    const fired = await evaluateRules(async () => ({}));
    expect(fired).toHaveLength(0);
  });

  it('fires when the metric crosses the threshold', async () => {
    await addRule(rule({ metric: 'sales_net_total', op: '<', threshold: 1000000 }));
    const exec = async (name: string) => {
      if (name === 'get_sales_items') return { total_net: 500000 };
      return {};
    };
    const fired = await evaluateRules(exec);
    expect(fired).toHaveLength(1);
    expect(fired[0].text).toContain('total net sales hari ini');
    expect(fired[0].text).toContain('500000');
  });

  it('does not fire when the metric is above the threshold', async () => {
    await addRule(rule({ metric: 'sales_net_total', op: '<', threshold: 1000000 }));
    const exec = async (name: string) => {
      if (name === 'get_sales_items') return { total_net: 2000000 };
      return {};
    };
    expect(await evaluateRules(exec)).toHaveLength(0);
  });

  it('skips a rule whose tool call throws', async () => {
    await addRule(rule({ metric: 'sales_net_total', op: '<', threshold: 1000000 }));
    const exec = async () => {
      throw new Error('tool down');
    };
    expect(await evaluateRules(exec)).toHaveLength(0);
  });

  it('respects cooldown: does not re-fire immediately', async () => {
    await addRule(rule({ metric: 'sales_net_total', op: '<', threshold: 1000000 }));
    const exec = async (name: string) => {
      if (name === 'get_sales_items') return { total_net: 500000 };
      return {};
    };
    const first = await evaluateRules(exec);
    expect(first).toHaveLength(1);
    // second run within cooldown window → no re-fire
    const second = await evaluateRules(exec);
    expect(second).toHaveLength(0);
  });

  it('fires for margin_item_pct with item match', async () => {
    await addRule(rule({ metric: 'margin_item_pct', item: 'geprek', op: '<', threshold: 30 }));
    const exec = async (name: string) => {
      if (name === 'get_margins') {
        return { items: [{ item: 'Ayam Geprek', qty: 10, net: 100000, margin_pct: 25 }] };
      }
      return {};
    };
    const fired = await evaluateRules(exec);
    expect(fired).toHaveLength(1);
    expect(fired[0].text).toContain('margin geprek kemarin');
  });

  it('persists last_fired after a fire', async () => {
    await addRule(rule({ metric: 'sales_net_total', op: '<', threshold: 1000000 }));
    const exec = async (name: string) => {
      if (name === 'get_sales_items') return { total_net: 500000 };
      return {};
    };
    await evaluateRules(exec);
    const raw = JSON.parse(readFileSync(join(dir, 'watch-rules.json'), 'utf8')) as WatchRule[];
    expect(raw[0].last_fired).toBeTruthy();
  });
});
