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
  { key: 'unpaid_supplier', label: 'Unpaid Supplier', format: 'idr' },
  { key: 'cash_difference', label: 'Selisih Kas', format: 'idr' },
  { key: 'transaction_count', label: 'Transaksi' },
  { key: 'aov', label: 'AOV', format: 'idr' }
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

          <Card title='Per outlet'>
            <FilterableRows rows={mod.rows} columns={COLUMNS} />
            <SourceTag source='Modul Keuangan (fin_daily_summary)' updatedAt={updated} />
          </Card>

          <Card title='Breakdown & detail'>
            <p className='text-xs text-muted-foreground'>
              Breakdown metode pembayaran, aging supplier, dan detail POS tersedia di modul Keuangan
              (endpoint publik summary tidak mengekspos rincian tersebut):
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
