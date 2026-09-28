/** /owner/keuangan — consolidated finance across outlets. */
import { getOverview, getFinanceRowsOn } from '@/lib/aggregate';
import { consolidateFinance } from '@/lib/consolidate';
import { idr, formatDateShort, formatTimeHm } from '@/lib/format';
import { MODULES, moduleUrl } from '@/lib/modules';
import { Card, EmptyState, SourceTag, StatusDot } from '@/components/ui';
import { FilterableRows, type Column } from '@/components/filterable-rows';
import { MockBanner } from '@/components/banners';

export const dynamic = 'force-dynamic';

const COLUMNS: Column[] = [
  { key: 'net_sales', label: 'Revenue', format: 'idr' },
  { key: 'total_expense', label: 'Expense', format: 'idr' },
  { key: 'estimated_surplus', label: 'Est. Surplus', format: 'idr' },
  { key: 'total_settlement', label: 'Settlement', format: 'idr' },
  { key: 'cogs', label: 'COGS', format: 'idr' },
  { key: 'gross_profit', label: 'Laba Kotor', format: 'idr' },
  { key: 'unpaid_supplier', label: 'Unpaid Supplier', format: 'idr' },
  { key: 'cash_difference', label: 'Selisih Kas', format: 'idr' },
  { key: 'transaction_count', label: 'Transaksi' },
  { key: 'aov', label: 'AOV', format: 'idr' }
];

const SETTLEMENT_LABELS: [string, string][] = [
  ['settle_cash', 'Cash'],
  ['settle_qris', 'QRIS'],
  ['settle_card', 'Card'],
  ['settle_transfer', 'Transfer/Lainnya'],
  ['settle_marketplace', 'Marketplace']
];

export default async function KeuanganPage() {
  const ov = await getOverview();
  const mod = ov.modules.finance;

  // MoM proxy: same calendar day last month vs today (public endpoint only).
  const prev = new Date(`${ov.date}T00:00:00+07:00`);
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const prevDate = prev.toISOString().slice(0, 10);
  const prevRows = ov.mock ? [] : await getFinanceRowsOn(prevDate);
  const kpi = consolidateFinance(mod.rows, prevRows);

  const f = MODULES.finance;
  const updated = formatTimeHm(mod.rows[0]?.created_at ?? '');
  const kpis: [string, string][] = [
    ['Revenue hari ini', idr(kpi.revenue)],
    ['Gross sales', idr(kpi.grossSales)],
    ['Total expense', idr(kpi.expense)],
    ['Estimasi Surplus Kas', idr(kpi.estimasiSurplus)],
    ['Posisi kas (est.)', idr(ov.headline.cashPosition)],
    ['Outstanding supplier', idr(kpi.unpaidSupplier)],
    ['Selisih kas', idr(kpi.cashDifference)],
    ['Transaksi', String(kpi.transactions)],
    ['AOV', idr(kpi.aov)],
    ['MoM revenue', kpi.momPct === null ? '—' : `${kpi.momPct >= 0 ? '+' : ''}${kpi.momPct}%`]
  ];

  return (
    <>
      {ov.mock && <MockBanner forced={ov.mockForced} />}
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-bold'>Keuangan — {formatDateShort(ov.date)}</h1>
        <StatusDot status={mod.status} />
      </div>

      {mod.status === 'offline' ? (
        <EmptyState message='Modul Keuangan tidak bisa dihubungi. Cek /owner/health.' />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5'>
            {kpis.map(([label, value]) => (
              <div key={label} className='rounded-lg border border-border bg-background p-3'>
                <p className='text-[10px] text-muted-foreground'>{label}</p>
                <p className='text-sm font-bold'>{value}</p>
              </div>
            ))}
          </div>

          <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
            <Card title='Breakdown Payment Method'>
              <p className='mb-2 text-[10px] text-muted-foreground'>Total settlement per metode (sync Moka)</p>
              {kpi.totalSettlement > 0 ? (
                <div className='space-y-1'>
                  {SETTLEMENT_LABELS.map(([key, label]) => {
                    const v = kpi.settlement[key] ?? 0;
                    const pct = Math.round((v / kpi.totalSettlement) * 1000) / 10;
                    return (
                      <div key={key} className='flex items-center gap-2 text-xs'>
                        <span className='w-32 shrink-0 text-muted-foreground'>{label}</span>
                        <div className='h-2.5 flex-1 overflow-hidden rounded bg-muted'>
                          <div className='h-full bg-primary/70' style={{ width: `${pct}%` }} />
                        </div>
                        <span className='w-36 shrink-0 text-right font-medium'>{idr(v)}</span>
                      </div>
                    );
                  })}
                  <p className='pt-1 text-[10px] text-muted-foreground'>Total settlement: {idr(kpi.totalSettlement)}</p>
                </div>
              ) : (
                <p className='text-xs text-muted-foreground'>Belum ada data settlement. Jalankan sync Moka untuk mengisi.</p>
              )}
            </Card>
            <Card title='Laba Kotor (Real)'>
              <p className='mb-2 text-[10px] text-muted-foreground'>Revenue − COGS aktual (item_sales Moka)</p>
              {kpi.cogs > 0 ? (
                <div className='space-y-1 text-xs'>
                  <p className='flex justify-between'><span className='text-muted-foreground'>Revenue</span><span className='font-medium'>{idr(kpi.revenue)}</span></p>
                  <p className='flex justify-between'><span className='text-muted-foreground'>COGS aktual</span><span className='font-medium'>− {idr(kpi.cogs)}</span></p>
                  <p className='flex justify-between border-t border-border pt-1'><span className='text-muted-foreground'>Laba kotor</span><span className='font-bold'>{idr(kpi.grossProfit)}</span></p>
                </div>
              ) : (
                <p className='text-xs text-muted-foreground'>COGS belum tersedia untuk tanggal ini (item sales Moka belum menyertakan biaya).</p>
              )}
            </Card>
          </div>

          <Card title='Per outlet'>
            <FilterableRows rows={mod.rows} columns={COLUMNS} />
            <SourceTag source='Modul Keuangan (fin_daily_summary)' updatedAt={updated} />
          </Card>

          <Card title='Breakdown & detail'>
            <p className='text-xs text-muted-foreground'>
              Aging supplier dan detail transaksi POS tersedia di modul Keuangan (endpoint publik summary
              kini juga membawa settlement per metode + COGS aktual dari sync Moka):
            </p>
            <div className='mt-2 flex flex-wrap gap-2 text-xs'>
              <a href={moduleUrl(f, '/finance/pos')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>POS & pembayaran ↗</a>
              <a href={moduleUrl(f, '/finance/suppliers')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Supplier & aging ↗</a>
              <a href={moduleUrl(f, '/finance/summary')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Ringkasan modul ↗</a>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
