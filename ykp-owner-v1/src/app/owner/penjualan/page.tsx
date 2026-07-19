/** /owner/penjualan — sales per item across outlets (Moka item import, read-only). */
import { MODULES, moduleUrl } from '@/lib/modules';
import { fetchJson, extractItems } from '@/lib/fetch';
import { idr, todayWib } from '@/lib/format';
import { Card, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';

const TOP_N = 10;

function daysAgo(n: number): string {
  const d = new Date(`${todayWib()}T00:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

interface ItemAgg {
  itemName: string;
  category: string;
  qty: number;
  gross: number;
  discount: number;
  refund: number;
  net: number;
  outlets: Set<string>;
  /** From warehouse recipe join; null when no recipe matches. */
  costPerPortion: number | null;
  costIncomplete: boolean;
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default async function PenjualanPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return typeof v === 'string' ? v.trim() : '';
  };
  const from = pick('from') || daysAgo(30);
  const to = pick('to') || todayWib();
  const outletFilter = pick('outlet');
  const itemFilter = pick('item');

  const def = MODULES.finance;
  const params = new URLSearchParams({ from, to });
  if (outletFilter) params.set('outlet_id', outletFilter);
  if (itemFilter) params.set('item', itemFilter);
  const whDef = MODULES.warehouse;
  const [res, costRes] = await Promise.all([
    fetchJson(`${moduleUrl(def, def.posItemsPath ?? '')}?${params.toString()}`),
    fetchJson(moduleUrl(whDef, whDef.recipeCostsPath ?? ''))
  ]);

  if (!res.ok) {
    return (
      <>
        <h1 className='text-lg font-bold'>Penjualan per Item</h1>
        <EmptyState message='Modul Keuangan tidak bisa dihubungi. Cek /owner/health.' />
      </>
    );
  }

  const rows = extractItems(res.data);
  const outletNames = [...new Set(rows.map((r) => r.outlet_name).filter(Boolean))].sort();

  // menu_name (normalized) → theoretical cost per portion from warehouse recipes
  const costByMenu = new Map<string, { cost: number; incomplete: boolean }>();
  if (costRes.ok) {
    for (const r of extractItems(costRes.data)) {
      costByMenu.set(normName(r.menu_name ?? ''), {
        cost: Number(r.cost_per_portion || 0),
        incomplete: r.incomplete === 'true'
      });
    }
  }

  const byItem = new Map<string, ItemAgg>();
  let totalQty = 0;
  let totalNet = 0;
  let totalGp = 0;
  for (const r of rows) {
    const key = r.item_name || '(tanpa nama)';
    const qty = Number(r.qty || 0);
    const net = Number(r.net_sales || 0);
    totalQty += qty;
    totalNet += net;
    const recipe = costByMenu.get(normName(key));
    const agg = byItem.get(key) ?? {
      itemName: key,
      category: r.category ?? '',
      qty: 0,
      gross: 0,
      discount: 0,
      refund: 0,
      net: 0,
      outlets: new Set<string>(),
      costPerPortion: recipe?.cost ?? null,
      costIncomplete: recipe?.incomplete ?? false
    };
    agg.qty += qty;
    agg.gross += Number(r.gross_sales || 0);
    agg.discount += Number(r.discount || 0);
    agg.refund += Number(r.refund || 0);
    agg.net += net;
    if (r.outlet_name) agg.outlets.add(r.outlet_name);
    byItem.set(key, agg);
  }
  const items = [...byItem.values()].sort((a, b) => b.net - a.net);
  const top = items.slice(0, TOP_N);
  const topMax = top[0]?.net ?? 0;
  for (const it of items) {
    if (it.costPerPortion !== null) totalGp += it.net - it.qty * it.costPerPortion;
  }

  return (
    <>
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-bold'>Penjualan per Item</h1>
        <span className='text-[11px] text-muted-foreground'>{rows.length} baris · {items.length} item</span>
      </div>

      <Card>
        <form method='GET' className='flex flex-wrap items-end gap-2'>
          <label className='text-[11px] text-muted-foreground'>
            Dari
            <input name='from' type='date' defaultValue={from} className='mt-0.5 block rounded border border-border bg-background px-2 py-1.5 text-xs' />
          </label>
          <label className='text-[11px] text-muted-foreground'>
            Sampai
            <input name='to' type='date' defaultValue={to} className='mt-0.5 block rounded border border-border bg-background px-2 py-1.5 text-xs' />
          </label>
          <label className='text-[11px] text-muted-foreground'>
            Item
            <input name='item' type='text' defaultValue={itemFilter} placeholder='cari item' className='mt-0.5 block w-32 rounded border border-border bg-background px-2 py-1.5 text-xs' />
          </label>
          <button type='submit' className='rounded bg-foreground px-3 py-1.5 text-xs font-semibold text-background'>
            Terapkan
          </button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState message='Belum ada data penjualan per item untuk periode ini. Import CSV Item Sales dari Moka di modul Keuangan (POS → Import Item CSV).' />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
            {([
              ['Item terjual', String(totalQty)],
              ['Net sales', idr(totalNet)],
              ['Item unik', String(items.length)],
              ['Est. gross profit', costByMenu.size > 0 ? idr(totalGp) : '—']
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className='rounded-lg border border-border bg-background p-3'>
                <p className='text-[10px] text-muted-foreground'>{label}</p>
                <p className='text-sm font-bold'>{value}</p>
              </div>
            ))}
          </div>

          <Card title={`Top ${TOP_N} item (net sales)`}>
            <div className='space-y-1.5'>
              {top.map((it) => (
                <div key={it.itemName} className='flex items-center gap-2 text-xs'>
                  <span className='w-40 truncate font-medium'>{it.itemName}</span>
                  <div className='h-3 flex-1 rounded bg-muted'>
                    <div
                      className='h-3 rounded bg-emerald-500'
                      style={{ width: `${topMax > 0 ? Math.max(2, Math.round((it.net / topMax) * 100)) : 0}%` }}
                    />
                  </div>
                  <span className='w-24 text-right font-semibold'>{idr(it.net)}</span>
                  <span className='w-14 text-right text-muted-foreground'>{it.qty} pcs</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title='Semua item'>
            <div className='overflow-x-auto'>
              <table className='w-full text-left text-xs'>
                <thead>
                  <tr className='border-b border-border text-[10px] uppercase text-muted-foreground'>
                    <th className='py-1.5 pr-3 font-medium'>Item</th>
                    <th className='py-1.5 pr-3 font-medium'>Kategori</th>
                    <th className='py-1.5 pr-3 text-right font-medium'>Qty</th>
                    <th className='py-1.5 pr-3 text-right font-medium'>Net</th>
                    <th className='py-1.5 pr-3 text-right font-medium'>COGS</th>
                    <th className='py-1.5 pr-3 text-right font-medium'>GP</th>
                    <th className='py-1.5 pr-3 text-right font-medium'>Margin</th>
                    <th className='py-1.5 pr-3 font-medium'>Outlet</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const cogs = it.costPerPortion !== null ? it.qty * it.costPerPortion : null;
                    const gp = cogs !== null ? it.net - cogs : null;
                    const margin = gp !== null && it.net > 0 ? Math.round((gp / it.net) * 100) : null;
                    return (
                      <tr key={it.itemName} className='border-b border-border/50'>
                        <td className='py-1.5 pr-3 font-medium'>
                          {it.itemName}
                          {it.costIncomplete && (
                            <span className='ml-1 rounded bg-amber-100 px-1 text-[9px] text-amber-800' title='Sebagian bahan tidak terhitung (unit tidak cocok)'>
                              biaya parsial
                            </span>
                          )}
                        </td>
                        <td className='py-1.5 pr-3 text-muted-foreground'>{it.category || '—'}</td>
                        <td className='py-1.5 pr-3 text-right'>{it.qty}</td>
                        <td className='py-1.5 pr-3 text-right'>{idr(it.net)}</td>
                        <td className='py-1.5 pr-3 text-right'>{cogs !== null ? idr(cogs) : '—'}</td>
                        <td className={`py-1.5 pr-3 text-right font-semibold ${gp !== null && gp < 0 ? 'text-red-600' : ''}`}>
                          {gp !== null ? idr(gp) : '—'}
                        </td>
                        <td className='py-1.5 pr-3 text-right'>{margin !== null ? `${margin}%` : '—'}</td>
                        <td className='py-1.5 pr-3 text-muted-foreground'>{[...it.outlets].join(', ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className='mt-2 text-[10px] text-muted-foreground'>
                COGS/GP dari resep teoretis gudang (qty × biaya per porsi). Item tanpa resep cocok ditandai —.
              </p>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
