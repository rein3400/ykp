/** /owner/investor — portfolio value, dividends, per-brand performance (read-only). */
import { getOverview } from '@/lib/aggregate';
import { consolidateFinance } from '@/lib/consolidate';
import { idr, formatDateShort, formatTimeHm } from '@/lib/format';
import { MODULES, moduleUrl } from '@/lib/modules';
import { Card, EmptyState, SourceTag, StatusDot } from '@/components/ui';
import { MockBanner } from '@/components/banners';

export const dynamic = 'force-dynamic';

export default async function InvestorPage() {
  const ov = await getOverview();
  const mod = ov.modules.investor;
  const inv = mod.rows[0];
  const i = MODULES.investor;
  const updated = formatTimeHm(inv?.created_at ?? '');

  // Per-brand performance from finance rows (read-only cross-reference).
  const fin = consolidateFinance(ov.modules.finance.rows);
  const byBrand = new Map<string, { revenue: number; surplus: number }>();
  for (const r of ov.modules.finance.rows) {
    const b = r.brand_name || 'Lainnya';
    const cur = byBrand.get(b) ?? { revenue: 0, surplus: 0 };
    cur.revenue += Number(r.net_sales ?? 0) || 0;
    cur.surplus += Number(r.estimated_surplus ?? 0) || 0;
    byBrand.set(b, cur);
  }

  return (
    <>
      {ov.mock && <MockBanner forced={ov.mockForced} />}
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-bold'>Investor — {formatDateShort(ov.date)}</h1>
        <StatusDot status={mod.status} />
      </div>

      {mod.status === 'offline' ? (
        <EmptyState message='Modul Investor tidak bisa dihubungi. Cek /owner/health.' />
      ) : !inv ? (
        <EmptyState message='Belum ada summary investor hari ini.' />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
            {([
              ['Total revenue', idr(Number(inv.total_revenue ?? 0) || 0)],
              ['Total profit', idr(Number(inv.total_profit ?? 0) || 0)],
              ['Total kapital', idr(Number(inv.total_capital ?? 0) || 0)],
              ['Investor aktif', inv.active_investors || '—'],
              ['Dividend declared', idr(Number(inv.dividend_declared ?? 0) || 0)],
              ['Growth', inv.growth_pct ? `${inv.growth_pct}%` : '—']
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className='rounded-lg border border-border bg-background p-3'>
                <p className='text-[10px] text-muted-foreground'>{label}</p>
                <p className='text-sm font-bold'>{value}</p>
              </div>
            ))}
          </div>

          <Card title='Performa per brand (hari ini, dari ringkasan Keuangan)'>
            <ul className='divide-y divide-border text-xs'>
              {[...byBrand.entries()].map(([brand, v]) => (
                <li key={brand} className='flex items-center justify-between py-2'>
                  <span className='font-medium'>{brand}</span>
                  <span>
                    Revenue <strong>{idr(v.revenue)}</strong>
                    <span className='ml-3'>Surplus <strong>{idr(v.surplus)}</strong></span>
                  </span>
                </li>
              ))}
            </ul>
            <SourceTag
              source='Modul Investor (inv_summary) + Keuangan (fin_daily_summary)'
              updatedAt={updated}
            />
            <p className='mt-1 text-[10px] text-muted-foreground'>
              Total seluruh outlet: revenue {idr(fin.revenue)} · Estimasi Surplus Kas {idr(fin.estimasiSurplus)}.
              Dividen paid vs declared dikelola di modul Investor.
            </p>
          </Card>

          <Card title='Detail'>
            <div className='flex flex-wrap gap-2 text-xs'>
              <a href={moduleUrl(i, '/investor/portfolio')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Portfolio ↗</a>
              <a href={moduleUrl(i, '/investor/dividend')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Dividend ↗</a>
              <a href={moduleUrl(i, '/investor/returns')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Returns ↗</a>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
