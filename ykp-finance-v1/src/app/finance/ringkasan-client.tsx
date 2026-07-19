'use client';
/**
 * Ringkasan — halaman utama owner (brief §6.1 + Revisi #2).
 * KPI wajib + filter brand/outlet/tanggal/bulan/payment method.
 * "Estimasi Surplus Kas" — TIDAK PERNAH "Net Profit" (Revisi #3).
 */
import { useMemo, useState } from 'react';
import {
  computeRingkasan, computeGroupCashPosition, momNetSalesGrowth, dailySeries,
  type FinanceRows
} from '@/lib/fin-summary';
import { lastNDays, todayWib, monthOf, prevMonth } from '@/lib/wib';
import { Kpi, Card, EmptyState, FilterBar, Bars, rp, rpSigned, Badge, Th, Td, type FilterState } from './ui';

const PM_LABELS: Record<string, string> = {
  settle_cash: 'Cash',
  settle_qris: 'QRIS',
  settle_card: 'Card',
  settle_transfer: 'Transfer',
  settle_marketplace: 'Marketplace'
};

export default function RingkasanClient(props: {
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
  pos: Record<string, string>[];
  expenses: Record<string, string>[];
  suppliers: Record<string, string>[];
  petty: Record<string, string>[];
  closing: Record<string, string>[];
  alerts: Record<string, string>[];
}) {
  const today = todayWib();
  const [f, setF] = useState<FilterState>({
    brandId: '', outletId: '', from: `${monthOf(today)}-01`, to: today
  });
  const [pmFilter, setPmFilter] = useState('');

  const rows: FinanceRows = useMemo(() => ({
    pos: props.pos, expenses: props.expenses, suppliers: props.suppliers,
    petty: props.petty, closing: props.closing
  }), [props.pos, props.expenses, props.suppliers, props.petty, props.closing]);

  const kpi = useMemo(() => computeRingkasan(rows, {
    from: f.from, to: f.to,
    brandId: f.brandId || undefined, outletId: f.outletId || undefined
  }), [rows, f]);

  const groupCash = useMemo(() => computeGroupCashPosition(props.petty, props.closing, {
    brandId: f.brandId || undefined, outletId: f.outletId || undefined
  }), [props.petty, props.closing, f.brandId, f.outletId]);

  const mom = useMemo(() => momNetSalesGrowth(
    props.pos.filter((r) => (!f.brandId || r.brand_id === f.brandId) && (!f.outletId || r.outlet_id === f.outletId)),
    monthOf(today), prevMonth(monthOf(today))
  ), [props.pos, f.brandId, f.outletId, today]);

  const trend = useMemo(() => dailySeries(rows, lastNDays(14, today), {
    brandId: f.brandId || undefined, outletId: f.outletId || undefined
  }), [rows, today, f.brandId, f.outletId]);

  // Payment method breakdown (settlement) within period
  const pmBreakdown = useMemo(() => {
    const totals: Record<string, number> = { settle_cash: 0, settle_qris: 0, settle_card: 0, settle_transfer: 0, settle_marketplace: 0 };
    for (const r of props.pos) {
      if (r.date < f.from || r.date > f.to) continue;
      if (f.brandId && r.brand_id !== f.brandId) continue;
      if (f.outletId && r.outlet_id !== f.outletId) continue;
      for (const k of Object.keys(totals)) totals[k] += Number(r[k] || 0);
    }
    return Object.entries(totals).map(([k, v]) => ({ key: k, label: PM_LABELS[k], value: v }));
  }, [props.pos, f]);

  const posFiltered = useMemo(() => props.pos
    .filter((r) => r.date >= f.from && r.date <= f.to
      && (!f.brandId || r.brand_id === f.brandId)
      && (!f.outletId || r.outlet_id === f.outletId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 15), [props.pos, f]);

  const unpaid = useMemo(() => props.suppliers
    .filter((r) => ['UNPAID', 'PARTIAL', 'OVERDUE'].includes((r.payment_status ?? '').toUpperCase())
      && Number(r.unpaid_amount) > 0
      && (!f.brandId || r.brand_id === f.brandId)
      && (!f.outletId || r.outlet_id === f.outletId))
    .sort((a, b) => Number(b.unpaid_amount) - Number(a.unpaid_amount))
    .slice(0, 8), [props.suppliers, f.brandId, f.outletId]);

  const latestAlerts = useMemo(() => props.alerts
    .filter((a) => a.status !== 'RESOLVED')
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 5), [props.alerts]);

  const hasData = props.pos.length > 0;

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Ringkasan Finance</h1>
        <p className='text-sm text-muted-foreground'>Pusat kontrol uang YKP — semua angka dalam Rupiah (IDR), timezone Asia/Jakarta.</p>
      </div>

      <FilterBar
        brands={props.brands}
        outlets={props.outlets}
        value={f}
        onChange={setF}
        extra={
          <>
            <div className='w-32'>
              <label className='mb-1 block text-[10px] font-medium text-muted-foreground'>Bulan</label>
              <input
                type='month'
                value={monthOf(f.from)}
                onChange={(e) => {
                  const m = e.target.value;
                  if (!m) return;
                  const [y, mm] = m.split('-').map(Number);
                  const lastDay = new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
                  setF({ ...f, from: `${m}-01`, to: lastDay < today ? lastDay : today });
                }}
                className='w-full rounded border border-border px-2 py-1.5 text-xs bg-background'
              />
            </div>
            <div className='w-40'>
              <label className='mb-1 block text-[10px] font-medium text-muted-foreground'>Payment Method</label>
              <select
                value={pmFilter}
                onChange={(e) => setPmFilter(e.target.value)}
                className='w-full rounded border border-border px-2 py-1.5 text-xs bg-background'
              >
                <option value=''>Semua Metode</option>
                {Object.values(PM_LABELS).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </>
        }
      />

      {!hasData ? (
        <EmptyState
          message={'Belum ada transaksi POS.\nImport CSV Moka atau tambah transaksi manual untuk memulai.'}
          ctaLabel='Buka Pendapatan POS'
          onCta={() => { window.location.href = '/finance/pos'; }}
        />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5'>
            <Kpi label='Net Sales' value={rp(kpi.netSales)} sub={`Gross ${rp(kpi.grossSales)}`} />
            <Kpi label='Total Expense' value={rp(kpi.totalExpense)} sub={kpi.topExpenseCategory ? `Terbesar: ${kpi.topExpenseCategory}` : undefined} />
            <Kpi label='Pembelian Supplier' value={rp(kpi.supplierCost)} sub={`Dibayar ${rp(kpi.supplierPaid)}`} />
            <Kpi label='Kas Kecil Keluar' value={rp(kpi.pettyCashOut)} />
            <Kpi label='Estimasi Surplus Kas' value={rpSigned(kpi.estimatedSurplus)} tone={kpi.estimatedSurplus < 0 ? 'bad' : 'good'} sub='Bukan net profit — COGS aktual belum tersedia' />
            <Kpi label='Group Cash Position' value={rp(groupCash)} sub='Kas fisik + saldo kas kecil' />
            <Kpi label='Outstanding Supplier' value={rp(kpi.unpaidSupplier)} tone={kpi.unpaidSupplier > 0 ? 'warn' : 'default'} sub='Accounts Payable' />
            <Kpi label='MoM Growth' value={mom === null ? 'N/A' : `${mom >= 0 ? '+' : ''}${mom.toFixed(1)}%`} sub='Net sales vs bulan lalu' tone={mom === null ? 'default' : mom >= 0 ? 'good' : 'bad'} />
            <Kpi label='Cash Inflow' value={rp(kpi.cashIn)} sub='Settlement POS' />
            <Kpi label='Cash Outflow' value={rp(kpi.cashOut)} sub='Supplier dibayar + expense + kas kecil' />
            <Kpi label='Transaksi' value={String(kpi.transactionCount)} sub={`AOV ${rp(kpi.aov)}`} />
            <Kpi label='Refund' value={rp(kpi.refund)} tone={kpi.refund > 0 ? 'warn' : 'default'} />
            <Kpi label='Void' value={rp(kpi.voidAmount)} tone={kpi.voidAmount > 0 ? 'warn' : 'default'} />
            <Kpi label='Top Supplier' value={kpi.topSupplier || '—'} sub='Spend terbesar periode ini' />
            <Kpi label='Top Expense Category' value={kpi.topExpenseCategory || '—'} sub='Kategori biaya terbesar' />
          </div>

          <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
            <Card title='Trend Net Sales 14 Hari' sub='Semua outlet dalam scope filter'>
              <Bars
                data={trend.map((d) => ({ label: d.date.slice(5), value: d.netSales, title: d.date }))}
                format={(n) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : `${Math.round(n / 1000)}rb`)}
              />
            </Card>
            <Card title='Breakdown Payment Method' sub='Total settlement per metode dalam periode'>
              <Bars
                data={pmBreakdown.map((p) => ({ label: p.label, value: p.value }))}
                format={(n) => rp(n)}
              />
              {kpi.settlementDifference !== 0 && (
                <p className='mt-2 text-[10px] text-amber-700'>
                  ⚠ Selisih settlement {rpSigned(kpi.settlementDifference)} — total metode ≠ net sales. Cek halaman POS.
                </p>
              )}
            </Card>
          </div>

          <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
            <Card title='Outstanding Supplier (AP)' sub='Tagihan belum lunas, terbesar dulu'>
              {unpaid.length === 0 ? (
                <p className='text-xs text-muted-foreground'>Tidak ada tagihan outstanding. Semua supplier lunas. ✅</p>
              ) : (
                <table className='w-full text-xs'>
                  <thead className='bg-muted text-muted-foreground'>
                    <tr><Th>Supplier</Th><Th>Invoice</Th><Th>Jatuh Tempo</Th><Th right>Sisa</Th><Th>Status</Th></tr>
                  </thead>
                  <tbody>
                    {unpaid.map((u) => (
                      <tr key={u.costing_id} className='border-t border-border'>
                        <Td bold>{u.supplier_name}</Td>
                        <Td muted>{u.invoice_number || u.costing_id}</Td>
                        <Td muted>{u.due_date || '—'}</Td>
                        <Td right bold>{rp(u.unpaid_amount)}</Td>
                        <Td><Badge value={u.payment_status} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card title='Alert Terbaru' sub='Dari finance rules engine (belum resolved)'>
              {latestAlerts.length === 0 ? (
                <p className='text-xs text-muted-foreground'>Belum ada alert. Generate laporan harian untuk menjalankan rules engine.</p>
              ) : (
                <div className='space-y-1'>
                  {latestAlerts.map((a) => (
                    <div key={a.alert_id} className='flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-xs'>
                      <div className='min-w-0'>
                        <p className='truncate font-medium'>{a.title}</p>
                        <p className='text-[10px] text-muted-foreground'>{a.date} · {a.outlet}</p>
                      </div>
                      <Badge value={a.severity} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card title='Transaksi POS Terbaru' sub='15 baris terakhir dalam periode'>
            <div className='overflow-x-auto'>
              <table className='w-full text-xs'>
                <thead className='bg-muted text-muted-foreground'>
                  <tr>
                    <Th>Tanggal</Th><Th>Outlet</Th><Th right>Gross</Th><Th right>Net</Th>
                    <Th right>Refund</Th><Th right>Void</Th><Th right>Trx</Th><Th right>AOV</Th><Th>Selisih Settlement</Th>
                  </tr>
                </thead>
                <tbody>
                  {posFiltered.map((p) => (
                    <tr key={p.pos_id} className='border-t border-border'>
                      <Td muted>{p.date}</Td>
                      <Td>{p.outlet_name}</Td>
                      <Td right>{rp(p.gross_sales)}</Td>
                      <Td right bold>{rp(p.net_sales)}</Td>
                      <Td right muted>{rp(p.refund)}</Td>
                      <Td right muted>{rp(p.void)}</Td>
                      <Td right muted>{p.transaction_count}</Td>
                      <Td right muted>{rp(p.aov)}</Td>
                      <Td>
                        {Number(p.settlement_difference) !== 0
                          ? <span className='text-amber-700 font-medium'>{rpSigned(p.settlement_difference)}</span>
                          : <span className='text-green-700'>✓</span>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
