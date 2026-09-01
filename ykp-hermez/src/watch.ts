/**
 * Standing watch rules ("kabari kalau margin geprek < 30%").
 * Rules are created via chat (LLM tool), stored as JSON, evaluated on a
 * timer against the data tools. Cooldown prevents alert spam.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIG, todayWib, daysAgoWib } from './config.js';

export interface WatchRule {
  id: string;
  metric: 'margin_item_pct' | 'sales_net_total' | 'sales_item_qty';
  item?: string;
  op: '<' | '>' | '<=' | '>=';
  threshold: number;
  note: string;
  created_at: string;
  last_fired?: string;
}

const FILE = () => join(CONFIG.dataDir, 'watch-rules.json');

async function load(): Promise<WatchRule[]> {
  try {
    return JSON.parse(await readFile(FILE(), 'utf8')) as WatchRule[];
  } catch {
    return [];
  }
}

async function save(rules: WatchRule[]): Promise<void> {
  await mkdir(CONFIG.dataDir, { recursive: true });
  await writeFile(FILE(), JSON.stringify(rules, null, 2));
}

export async function listRules(): Promise<WatchRule[]> {
  return load();
}

export async function addRule(r: Omit<WatchRule, 'id' | 'created_at'>): Promise<WatchRule> {
  const rules = await load();
  const rule: WatchRule = {
    ...r,
    id: `WR-${Date.now().toString(36).toUpperCase()}`,
    created_at: todayWib()
  };
  rules.push(rule);
  await save(rules);
  return rule;
}

export async function deleteRule(id: string): Promise<boolean> {
  const rules = await load();
  const next = rules.filter((r) => r.id !== id);
  if (next.length === rules.length) return false;
  await save(next);
  return true;
}

function cmp(value: number, op: WatchRule['op'], threshold: number): boolean {
  switch (op) {
    case '<': return value < threshold;
    case '>': return value > threshold;
    case '<=': return value <= threshold;
    case '>=': return value >= threshold;
  }
}

interface MarginItem { item: string; qty: number; net: number; margin_pct?: number | null; gp?: number }
interface Metrics {
  margin_item_pct: { items: MarginItem[] };
  sales_net_total: { total_net: number };
  sales_item_qty: { items: { item: string; qty: number }[] };
}

/** Evaluate all rules; returns fired messages (caller sends them). */
export async function evaluateRules(
  exec: (name: string, args: Record<string, unknown>) => Promise<unknown>
): Promise<{ rule: WatchRule; text: string }[]> {
  const rules = await load();
  if (rules.length === 0) return [];
  const fired: { rule: WatchRule; text: string }[] = [];
  const cooldownMs = CONFIG.watchCooldownHours * 3600 * 1000;
  const now = Date.now();
  let dirty = false;

  for (const rule of rules) {
    if (rule.last_fired && now - Date.parse(rule.last_fired) < cooldownMs) continue;
    let value: number | null = null;
    let label = '';
    try {
      if (rule.metric === 'margin_item_pct') {
        const res = (await exec('get_margins', { from: daysAgoWib(1), to: todayWib() })) as Metrics['margin_item_pct'];
        const it = res.items.find((i) => i.item.toLowerCase().includes((rule.item ?? '').toLowerCase()));
        value = it?.margin_pct ?? null;
        label = `margin ${rule.item} kemarin`;
      } else if (rule.metric === 'sales_net_total') {
        const res = (await exec('get_sales_items', { from: todayWib(), to: todayWib() })) as Metrics['sales_net_total'];
        value = res.total_net;
        label = 'total net sales hari ini';
      } else if (rule.metric === 'sales_item_qty') {
        const res = (await exec('get_sales_items', { from: todayWib(), to: todayWib() })) as Metrics['sales_item_qty'];
        const it = res.items.find((i) => i.item.toLowerCase().includes((rule.item ?? '').toLowerCase()));
        value = it?.qty ?? 0;
        label = `qty ${rule.item} hari ini`;
      }
    } catch {
      continue; // tool failure → skip this round
    }
    if (value === null) continue;
    if (cmp(value, rule.op, rule.threshold)) {
      rule.last_fired = new Date().toISOString();
      dirty = true;
      fired.push({
        rule,
        text: `⚠️ <b>Watch rule ${rule.id}</b>\n${label}: <b>${value}</b> ${rule.op} ${rule.threshold}\n${rule.note}`
      });
    }
  }
  if (dirty) await save(rules);
  return fired;
}
