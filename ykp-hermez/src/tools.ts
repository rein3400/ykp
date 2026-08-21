/**
 * Hermez data tools — thin read-only wrappers over the modules' PUBLIC
 * endpoints (the same ones the owner dashboard uses). Every tool returns
 * COMPACT json (aggregated/top-N) to keep the LLM context small.
 * A failing module degrades to {error} instead of killing the whole call.
 *
 * Scope: every tool receives the caller's Scope and filters rows to the
 * caller's brand/outlet before aggregating, so a department head never sees
 * another brand/outlet's numbers. Owner/super_admin/hr_admin/finance_admin
 * pass an empty scope and see everything.
 */
import { CONFIG, todayWib, daysAgoWib } from './config.js';
import type { ToolSpec } from './llm.js';
import type { Scope } from './actor.js';
import { filterRows, filterPerOutlet, filterItems } from './scope.js';

type Row = Record<string, string>;

/** Result of a module fetch: rows on success, or an `error` tag when the
 *  module was unreachable (non-OK status, auth failure, timeout). Returning
 *  `[]` would mask a 401/config outage as "no data"; the AI now sees the
 *  error so it can say "modul X tidak terjangkau" instead. */
interface FetchResult {
  rows: Row[];
  error?: string;
}

async function fetchRows(url: string, timeoutMs = 6000): Promise<FetchResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: CONFIG.botSecret ? { 'x-bot-secret': CONFIG.botSecret } : {}
    });
    if (!res.ok) {
      return { rows: [], error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as { data?: { items?: Row[] } };
    return { rows: json.data?.items ?? [] };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : 'fetch failed' };
  } finally {
    clearTimeout(t);
  }
}

/** Filter helper that tolerates an errored fetch: log the error and filter
 *  the (empty) row set so the tool still produces partial output instead of
 *  throwing and killing the whole multi-module call. */
function scopedRows(res: FetchResult, scope: Scope, use: typeof filterRows): Row[] {
  if (res.error) {
    console.warn(`[tools] fetch failed (${res.error}); treating as empty`);
  }
  return use(res.rows, scope);
}

/** Surface the first error among parallel fetches as a `sumber_error` note so
 *  the AI can distinguish "modul tidak terjangkau" from genuine empty data. */
function firstError(results: FetchResult[]): string | undefined {
  for (const r of results) if (r.error) return r.error;
  return undefined;
}

const num = (v: string | undefined): number => Number(v || 0) || 0;
const top = <T>(arr: T[], n: number): T[] => arr.slice(0, n);

// ── Tool implementations ─────────────────────────────────────────────

async function getOverview(args: { date?: string }, scope: Scope): Promise<unknown> {
  const date = args.date || todayWib();
  const m = CONFIG.modules;
  const [fin, wh, ops, hr, inv] = await Promise.all([
    fetchRows(`${m.finance}/api/finance/summary`),
    fetchRows(`${m.warehouse}/api/warehouse/summary`),
    fetchRows(`${m.ops}/api/ops/summary?date=${date}`),
    fetchRows(`${m.hr}/api/hr/summary?date=${date}`),
    fetchRows(`${m.investor}/api/investor/summary`)
  ]);
  const finS = scopedRows(fin, scope, filterRows);
  const whS = scopedRows(wh, scope, filterRows);
  const opsS = scopedRows(ops, scope, filterRows);
  const hrS = scopedRows(hr, scope, filterRows);
  const sum = (rows: Row[], k: string) => rows.reduce((s, r) => s + num(r[k]), 0);
  const err = firstError([fin, wh, ops, hr, inv]);
  return {
    date,
    sumber_error: err,
    keuangan: {
      rows: finS.length,
      revenue: sum(finS, 'revenue'),
      estimasi_surplus_kas: sum(finS, 'estimated_surplus'),
      total_expense: sum(finS, 'total_expense'),
      unpaid_supplier: sum(finS, 'unpaid_supplier'),
      per_outlet: top(finS.map((r) => ({
        outlet: r.outlet_name, revenue: num(r.revenue), surplus: num(r.estimated_surplus)
      })), 15)
    },
    gudang: {
      rows: whS.length,
      nilai_inventari: sum(whS, 'total_inventory_value'),
      stok_kritis: sum(whS, 'critical_low_stock_count'),
      near_expiry: sum(whS, 'near_expiry_item_count'),
      varians: sum(whS, 'unexplained_variance_value')
    },
    operasional: {
      rows: opsS.length,
      outlets: opsS.map((r) => ({
        outlet: r.outlet_name,
        status: r.outlet_ready_status ?? r.status ?? '',
        checklist_pct: num(r.checklist_completion_pct),
        insiden: num(r.high_severity_incident_count ?? r.incident_count)
      }))
    },
    sdm: {
      rows: hrS.length,
      hadir: sum(hrS, 'present_count'),
      terlambat: sum(hrS, 'late_count'),
      absen: sum(hrS, 'absent_count')
    },
    investor: inv.rows[0] ?? { info: inv.error ? `modul tidak terjangkau (${inv.error})` : 'no summary rows' }
  };
}

async function getSalesItems(args: { from?: string; to?: string; outlet_id?: string; item?: string }, scope: Scope): Promise<unknown> {
  const from = args.from || daysAgoWib(7);
  const to = args.to || todayWib();
  const q = new URLSearchParams({ from, to });
  if (args.outlet_id) q.set('outlet_id', args.outlet_id);
  if (args.item) q.set('item', args.item);
  const res = await fetchRows(`${CONFIG.modules.finance}/api/finance/pos/items?${q}`);
  const rows = scopedRows(res, scope, filterItems);
  const byItem = new Map<string, { item: string; qty: number; net: number; outlets: Set<string> }>();
  let totalNet = 0;
  let totalQty = 0;
  for (const r of rows) {
    const key = r.item_name || '(?)';
    const e = byItem.get(key) ?? { item: key, qty: 0, net: 0, outlets: new Set<string>() };
    e.qty += num(r.qty);
    e.net += num(r.net_sales);
    totalNet += num(r.net_sales);
    totalQty += num(r.qty);
    if (r.outlet_name) e.outlets.add(r.outlet_name);
    byItem.set(key, e);
  }
  const items = [...byItem.values()]
    .sort((a, b) => b.net - a.net)
    .map((e) => ({ ...e, outlets: [...e.outlets] }));
  return { from, to, total_qty: totalQty, total_net: totalNet, items: top(items, 20), baris_mentah: rows.length, sumber_error: res.error };
}

async function getMargins(args: { from?: string; to?: string }, scope: Scope): Promise<unknown> {
  const from = args.from || daysAgoWib(7);
  const to = args.to || todayWib();
  const [posRes, costRes] = await Promise.all([
    fetchRows(`${CONFIG.modules.finance}/api/finance/pos/items?from=${from}&to=${to}`),
    fetchRows(`${CONFIG.modules.warehouse}/api/warehouse/recipe-costs`)
  ]);
  const posScoped = scopedRows(posRes, scope, filterItems);
  const costRows = costRes.rows;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const cost = new Map(costRows.map((r) => [norm(r.menu_name ?? ''), num(r.cost_per_portion)]));
  const byItem = new Map<string, { item: string; qty: number; net: number }>();
  for (const r of posScoped) {
    const key = r.item_name || '(?)';
    const e = byItem.get(key) ?? { item: key, qty: 0, net: 0 };
    e.qty += num(r.qty);
    e.net += num(r.net_sales);
    byItem.set(key, e);
  }
  let totalGp = 0;
  let matched = 0;
  const items = [...byItem.values()].map((e) => {
    const cpp = cost.get(norm(e.item));
    if (cpp === undefined) return { ...e, margin: null };
    matched++;
    const cogs = e.qty * cpp;
    const gp = e.net - cogs;
    totalGp += gp;
    return {
      ...e,
      cogs,
      gp,
      margin_pct: e.net > 0 ? Math.round((gp / e.net) * 100) : null
    };
  }).sort((a, b) => b.net - a.net);
  return {
    from, to,
    total_net: posScoped.reduce((s, r) => s + num(r.net_sales), 0),
    total_gp: totalGp,
    items_matched_recipe: matched,
    items_total: items.length,
    note: 'COGS dari resep teoretis gudang; item tanpa resep tidak dihitung GP',
    items: top(items, 20),
    sumber_error: firstError([posRes, costRes])
  };
}

async function getActivity(args: { from?: string; to?: string; module?: string; user?: string }, scope: Scope): Promise<unknown> {
  const from = args.from || todayWib();
  const to = args.to || from;
  const m = CONFIG.modules;
  const targets: Record<string, string> = {
    finance: `${m.finance}/api/finance/audit`,
    hr: `${m.hr}/api/hr/audit`,
    warehouse: `${m.warehouse}/api/warehouse/audit`,
    ops: `${m.ops}/api/ops/audit`,
    investor: `${m.investor}/api/investor/audit`
  };
  const keys = args.module && args.module in targets ? [args.module] : Object.keys(targets);
  const results = await Promise.all(
    keys.map(async (k) => {
      const res = await fetchRows(`${targets[k]}?from=${from}&to=${to}&limit=100`);
      return { key: k, res };
    })
  );
  const errors = results.filter((r) => r.res.error).map((r) => `${r.key}: ${r.res.error}`);
  const rows = results.flatMap((r) =>
    r.res.rows.map((row) => ({
      waktu: row.created_at ?? row.timestamp ?? '',
      modul: r.key,
      user: row.user_id ?? row.actor_user_id ?? '',
      aksi: row.action ?? '',
      entitas: row.record_type ?? row.entity ?? '',
      id: row.record_id ?? row.entity_id ?? ''
    }))
  );
  const filtered = args.user ? rows.filter((r) => r.user.toLowerCase().includes(String(args.user).toLowerCase())) : rows;
  filtered.sort((a, b) => b.waktu.localeCompare(a.waktu));
  return { from, to, total: filtered.length, entries: top(filtered, 40), sumber_error: errors.length ? errors.join('; ') : undefined };
}

async function getInventory(scope: Scope): Promise<unknown> {
  const res = await fetchRows(`${CONFIG.modules.warehouse}/api/warehouse/summary`);
  const rows = scopedRows(res, scope, filterRows);
  const sum = (k: string) => rows.reduce((s, r) => s + num(r[k]), 0);
  return {
    nilai_inventori: sum('total_inventory_value'),
    stok_kritis: sum('critical_low_stock_count'),
    risiko_stockout: sum('stockout_risk_count'),
    near_expiry: sum('near_expiry_item_count'),
    expired: sum('expired_item_count'),
    waste_hari_ini: sum('waste_value'),
    estimasi_pembelian: sum('estimated_purchase_value'),
    per_outlet: top(rows.map((r) => ({
      outlet: r.outlet_name,
      nilai: num(r.total_inventory_value),
      kritis: num(r.critical_low_stock_count)
    })), 15),
    sumber_error: res.error
  };
}

async function getHr(args: { date?: string }, scope: Scope): Promise<unknown> {
  const date = args.date || todayWib();
  const res = await fetchRows(`${CONFIG.modules.hr}/api/hr/summary?date=${date}`);
  const rows = scopedRows(res, scope, filterRows);
  const sum = (k: string) => rows.reduce((s, r) => s + num(r[k]), 0);
  return {
    date,
    terjadwal: sum('scheduled_count'),
    hadir: sum('present_count'),
    terlambat: sum('late_count'),
    absen: sum('absent_count'),
    cuti: sum('leave_count'),
    per_outlet: top(rows.map((r) => ({
      outlet: r.outlet_name, hadir: num(r.present_count), telat: num(r.late_count), absen: num(r.absent_count)
    })), 15),
    sumber_error: res.error
  };
}

async function getAlerts(scope: Scope): Promise<unknown> {
  const m = CONFIG.modules;
  const [finA, whA, opsA, finAct, whAct, opsAct] = await Promise.all([
    fetchRows(`${m.finance}/api/finance/alerts`),
    fetchRows(`${m.warehouse}/api/warehouse/alerts`),
    fetchRows(`${m.ops}/api/ops/alerts`),
    fetchRows(`${m.finance}/api/finance/actions`),
    fetchRows(`${m.warehouse}/api/warehouse/actions`),
    fetchRows(`${m.ops}/api/ops/actions`)
  ]);
  const open = (res: FetchResult, modul: string) =>
    scopedRows(res, scope, filterRows)
      .filter((r) => (r.status ?? '').toUpperCase() !== 'CLOSED' && (r.status ?? '').toUpperCase() !== 'RESOLVED')
      .map((r) => ({ modul, severity: r.severity ?? '', pesan: r.message ?? r.title ?? '', status: r.status ?? '', tanggal: r.date ?? r.created_at ?? '' }));
  const openAct = (res: FetchResult, modul: string) =>
    scopedRows(res, scope, filterRows)
      .filter((r) => (r.status ?? '').toUpperCase() !== 'DONE' && (r.status ?? '').toUpperCase() !== 'CLOSED')
      .map((r) => ({ modul, judul: r.title ?? r.action ?? '', pic: r.pic ?? r.assignee ?? '', due: r.due_date ?? '' }));
  return {
    alerts: top([...open(finA, 'finance'), ...open(whA, 'warehouse'), ...open(opsA, 'ops')], 25),
    actions: top([...openAct(finAct, 'finance'), ...openAct(whAct, 'warehouse'), ...openAct(opsAct, 'ops')], 25),
    sumber_error: firstError([finA, whA, opsA, finAct, whAct, opsAct])
  };
}

async function getPhotos(args: { entity_type?: string; limit?: number }, scope: Scope): Promise<unknown> {
  const m = CONFIG.modules;
  const q = args.entity_type ? `?entity_type=${encodeURIComponent(args.entity_type)}` : '';
  const [wh, ops, inv] = await Promise.all([
    fetchRows(`${m.warehouse}/api/warehouse/attachments${q}`),
    fetchRows(`${m.ops}/api/ops/attachments${q}`),
    fetchRows(`${m.investor}/api/investor/attachments${q}`)
  ]);
  const lim = args.limit ?? 10;
  const mapRows = (res: FetchResult, base: string, modul: string) =>
    scopedRows(res, scope, filterRows).map((r) => ({
      modul,
      jenis: r.entity_type,
      entitas: r.entity_id,
      oleh: r.uploaded_by,
      waktu: r.created_at,
      url: `${base}/api/${modul}/attachments/${r.attachment_id}/file`
    }));
  const all = [
    ...mapRows(wh, m.warehouse, 'warehouse'),
    ...mapRows(ops, m.ops, 'ops'),
    ...mapRows(inv, m.investor, 'investor')
  ].sort((a, b) => b.waktu.localeCompare(a.waktu));
  return { total: all.length, photos: top(all, lim), note: 'URL bisa dibuka langsung di browser', sumber_error: firstError([wh, ops, inv]) };
}

async function getInvestorStatus(scope: Scope): Promise<unknown> {
  const res = await fetchRows(`${CONFIG.modules.investor}/api/investor/summary`);
  const rows = scopedRows(res, scope, filterRows);
  return {
    summary: rows[0] ?? { info: res.error ? `modul tidak terjangkau (${res.error})` : 'no summary rows' },
    rows: rows.length,
    sumber_error: res.error
  };
}

// ── Registry ─────────────────────────────────────────────────────────

type Handler = (args: Record<string, unknown>, scope: Scope) => Promise<unknown>;

export const TOOL_HANDLERS: Record<string, Handler> = {
  get_overview: (a, s) => getOverview(a as { date?: string }, s),
  get_sales_items: (a, s) => getSalesItems(a as { from?: string; to?: string; outlet_id?: string; item?: string }, s),
  get_margins: (a, s) => getMargins(a as { from?: string; to?: string }, s),
  get_activity: (a, s) => getActivity(a as { from?: string; to?: string; module?: string; user?: string }, s),
  get_inventory: (_a, s) => getInventory(s),
  get_hr: (a, s) => getHr(a as { date?: string }, s),
  get_alerts: (_a, s) => getAlerts(s),
  get_photos: (a, s) => getPhotos(a as { entity_type?: string; limit?: number }, s),
  get_investor_status: (_a, s) => getInvestorStatus(s)
};

const dateParams = (extra: Record<string, unknown> = {}) => ({
  type: 'object',
  properties: {
    from: { type: 'string', description: 'YYYY-MM-DD, default 7 hari lalu' },
    to: { type: 'string', description: 'YYYY-MM-DD, default hari ini' },
    ...extra
  }
});

export const TOOL_SPECS: ToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'get_overview',
      description: 'Ringkasan semua modul untuk satu tanggal: revenue, surplus kas, expense, stok, checklist outlet, kehadiran SDM, investor. Pakai untuk pertanyaan umum "gimana hari ini/bisnis/cabang".',
      parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD, default hari ini' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_sales_items',
      description: 'Penjualan per item (dari import Moka): qty, net sales, per outlet. Pakai untuk "penjualan item X", "menu terlaris", "sales minggu ini".',
      parameters: dateParams({ outlet_id: { type: 'string' }, item: { type: 'string', description: 'filter nama item (partial)' } })
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_margins',
      description: 'Margin/gross profit per item: net sales, COGS teoretis dari resep, GP, margin%. Pakai untuk pertanyaan margin/profitabilitas menu.',
      parameters: dateParams()
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_activity',
      description: 'Jejak audit: semua aksi user di semua modul (siapa melakukan apa, kapan). Pakai untuk "siapa yang ubah X", "aktivitas mencurigakan", "semua aksi user Y".',
      parameters: dateParams({
        module: { type: 'string', description: 'finance|hr|warehouse|ops|investor, default semua' },
        user: { type: 'string', description: 'filter user_id (partial)' }
      })
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_inventory',
      description: 'Status gudang: nilai inventori, stok kritis, near expiry, waste, estimasi pembelian.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_hr',
      description: 'Kehadiran SDM per tanggal: hadir, terlambat, absen, cuti per outlet.',
      parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD, default hari ini' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_alerts',
      description: 'Semua alert terbuka + action tracker yang belum selesai di semua modul.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_photos',
      description: 'Foto bukti terbaru (timbang receiving, struk ops, MOU investor) dengan URL yang bisa diklik.',
      parameters: { type: 'object', properties: { entity_type: { type: 'string', description: 'receiving|receipt|mou' }, limit: { type: 'number', description: 'default 10' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_investor_status',
      description: 'Ringkasan investor: revenue, profit, capital, dividen.',
      parameters: { type: 'object', properties: {} }
    }
  }
];
