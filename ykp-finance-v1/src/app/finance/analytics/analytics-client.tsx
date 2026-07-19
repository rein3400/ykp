'use client';
/**
 * Analitik — Revisi #9: revenue/expense/supplier trends, payment-method
 * breakdown, cost ratio, AOV trend, refund/void trend, unpaid aging,
 * brand contribution, outlet comparison. Filter brand/outlet/periode.
 */
import { useMemo, useState } from 'react';
import { dailySeries, unpaidAging, computeRingkasan, type FinanceRows } from '@/lib/fin-summary';
import { lastNDays, todayWib } from '@/lib/wib';
import { Card, FilterBar, Bars, rp, rpSigned, type FilterState } from '../ui';

const PM_LABELS: [string, string][] = [
  ['settle_cash', 'Cash'], ['settle_qris', 'QRIS'], ['settle_card', 'Card'],
  ['settle_transfer', 'Transfer'], ['settle_marketplace', 'Marketplace']
];

export default function AnalyticsClient(props: {
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
  pos: Record<string, string>[];
  expenses: Record<string, string>[];
  suppliers: Record<string, string>[];
  petty: Record<string, string>[];
  closing: Record<string, string>[];
}) {
  const today = todayWib();
  const [f, setF] = useState<FilterState>({ brandId: '', outletId: '', from: lastNDays(14, today)[0], to: today });
  const days = useMemo(() => {
    const out: string[] = [];
    let d = f.from;
    while (d <= f.to && out.length < 62) { out.push(d); d = nextDay(d); }
    return out;
  }, [f.from, f.to]);

  const rows: FinanceRows = useMemo(() => ({
    pos: props.pos, expenses: props.expenses, suppliers: props.suppliers, petty: props.petty, closing: props.closing
  }), [props.pos, props.expenses, props.suppliers, props.petty, props.closing]);

  const scope = { brandId: f.brandId || undefined, outletId: f.outletId || undefined };
  const series = useMemo(() => dailySeries(rows, days, scope), [rows, days, scope.brandId, scope.outletId]); // eslint-disable-line react-hooks/exhaustive-deps
  const kpi = useMemo(() => computeRingkasan(rows, { from: f.from, to: f.to, ...scope }), [rows, f.from, f.to, scope.brandId, scope.outletId]); // eslint-disable-line react-hooks/exhaustive-deps
  const aging = useMemo(() => unpaidAging(props.suppliers, today, scope), [props.suppliers, today, scope.brandId, scope.outletId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pmTotals = PM_LABELS.map(([k, label]) => ({
    label,
    value: props.pos
      .filter((r) => r.date >= f.from && r.date <= f.to
        && (!f.brandId || r.brand_id === f.brandId) && (!f.outletId || r.outlet_id === f.outletId))
      .reduce((s, r) => s + Number(r[k] || 0), 0)
  }));

  const brandContribution = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of props.pos) {
      if (r.date < f.from || r.date > f.to) continue;
      if (f.outletId && r.outlet_id !== f.outletId) continue;
      m.set(r.brand_name, (m.get(r.brand_name) ?? 0) + Number(r.net_sales || 0));
    }
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [props.pos, f]);

  const outletComparison = useMemo(() => props.outlets
    .filter((o) => (!f.brandId || o.brand_id === f.brandId) && (!f.outletId || o.outlet_id === f.outletId))
    .map((o) => {
      const k = computeRingkasan(rows, { from: f.from, to: f.to, outletId: o.outlet_id });
      return { label: o.outlet_name, value: k.netSales, surplus: k.estimatedSurplus };
    })
    .sort((a, b) => b.value - a.value),
  [props.outlets, rows, f]);

  const costRatio = kpi.netSales > 0
    ? Math.round(((kpi.totalExpense + kpi.supplierCost + kpi.pettyCashOut) / kpi.netSales) * 100)
    : 0;

  const fmtJt = (n: number) => (Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : `${Math.round(n / 1000)}rb`);

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Analitik</h1>
        <p className='text-sm text-muted-foreground'>Trend dan perbandingan lintas brand/outlet dalam periode terpilih.</p>
      </div>

      <FilterBar brands={props.brands} outlets={props.outlets} value={f} onChange={setF} />

      <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
        <Card title='Revenue Trend' sub='Net sales harian'>
          <Bars data={series.map((d) => ({ label: d.date.slice(5), value: d.netSales, title: d.date }))} format={fmtJt} />
        </Card>
        <Card title='Expense Trend' sub='Expense + supplier cost + kas kecil harian'>
          <Bars data={series.map((d) => ({ label: d.date.slice(5), value: d.expense + d.supplierCost + d.pettyCashOut, title: d.date }))} format={fmtJt} />
        </Card>
        <Card title='Supplier Trend' sub='Pembelian supplier harian'>
          <Bars data={series.map((d) => ({ label: d.date.slice(5), value: d.supplierCost, title: d.date }))} format={fmtJt} />
        </Card>
        <Card title='Payment Method Breakdown' sub='Settlement per metode'>
          <Bars data={pmTotals} format={(n) => rp(n)} />
        </Card>
        <Card title='AOV Trend' sub='Average order value harian'>
          <Bars data={series.map((d) => ({ label: d.date.slice(5), value: d.aov, title: d.date }))} format={(n) => `${Math.round(n / 1000)}rb`} />
        </Card>
        <Card title='Refund / Void Trend' sub='Refund + void harian'>
          <Bars data={series.map((d) => ({ label: d.date.slice(5), value: d.refundVoid, title: d.date }))} format={fmtJt} />
        </Card>
      </div>

      <div className='grid grid-cols-1 gap-3 lg:grid-cols-3'>
        <Card title='Unpaid Supplier Aging' sub='Outstanding per umur jatuh tempo'>
          <Bars
            data={[
              { label: 'Belum jatuh tempo', value: aging.current },
              { label: '1–7 hari', value: aging.d1_7 },
              { label: '8–14 hari', value: aging.d8_14 },
              { label: '15–30 hari', value: aging.d15_30 },
              { label: '>30 hari', value: aging.over30 }
            ]}
            format={(n) => rp(n)}
          />
        </Card>
        <Card title='Kontribusi Brand' sub='Net sales per brand'>
          <Bars data={brandContribution} format={fmtJt} />
        </Card>
        <Card title='Perbandingan Outlet' sub='Net sales (label kanan: estimasi surplus kas)'>
          <Bars
            data={outletComparison.map((o) => ({ label: o.label, value: o.value, title: `Surplus: ${rpSigned(o.surplus)}` }))}
            format={fmtJt}
          />
        </Card>
      </div>

      <Card title='Cost Ratio' sub='(Expense + supplier cost + kas kecil) / net sales periode'>
        <div className='flex items-center gap-3'>
          <div className='h-4 flex-1 rounded bg-muted overflow-hidden'>
            <div className={`h-full ${costRatio > 80 ? 'bg-red-500' : costRatio > 60 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, costRatio)}%` }} />
          </div>
          <span className='text-sm font-bold'>{costRatio}%</span>
        </div>
        <p className='mt-2 text-[10px] text-muted-foreground'>
          Biaya {rp(kpi.totalExpense + kpi.supplierCost + kpi.pettyCashOut)} vs net sales {rp(kpi.netSales)}.
          Rasio &gt;100% berarti estimasi surplus kas negatif.
        </p>
      </Card>
    </div>
  );
}

function nextDay(d: string): string {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10);
}
