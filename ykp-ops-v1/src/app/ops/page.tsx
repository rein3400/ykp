import { readTab, TABS } from '@/db/sheets';
import { formatIdr } from '@/lib/format';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OpsOverviewPage() {
  const summaries = await readTab(TABS.summary);
  const latest = summaries.slice(-5).reverse();
  const incidents = await readTab(TABS.incidents);
  const openIncidents = incidents.filter((r) => r.status !== 'DONE' && r.status !== 'CANCELLED').length;
  const opening = await readTab(TABS.opening);
  const kds = await readTab(TABS.kds);
  const overSla = kds.filter((r) => r.sla_status === 'OVER_SLA' || r.sla_status === 'CRITICAL_DELAY').length;

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Ringkasan Operational</h1>
        <p className='text-sm text-slate-500'>Kondisi outlet hari ini — siap dibaca Hermez.</p>
      </div>

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Kpi label='Summary rows' value={String(summaries.length)} />
        <Kpi label='Open incidents' value={String(openIncidents)} tone={openIncidents > 0 ? 'warn' : 'ok'} />
        <Kpi label='Orders over SLA' value={String(overSla)} tone={overSla > 0 ? 'warn' : 'ok'} />
        <Kpi label='Opening items' value={String(opening.length)} />
      </div>

      <div className='flex flex-wrap gap-2'>
        <Link href='/ops/opening' className='rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-slate-50'>Opening</Link>
        <Link href='/ops/kds' className='rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-slate-50'>KDS</Link>
        <Link href='/ops/incidents' className='rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-slate-50'>Incidents</Link>
        <Link href='/ops/closing' className='rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-slate-50'>Closing</Link>
        <Link href='/ops/waste' className='rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-slate-50'>Waste</Link>
      </div>

      <div className='rounded-xl border bg-white p-4'>
        <h2 className='mb-3 font-semibold'>Daily Summary (latest)</h2>
        {latest.length === 0 ? (
          <p className='text-sm text-slate-500'>Belum ada summary. Generate dari Analytics atau POST /api/ops/summary/regenerate.</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead className='border-b text-xs text-slate-500'>
                <tr>
                  <th className='py-2 pr-3'>Date</th>
                  <th className='py-2 pr-3'>Outlet</th>
                  <th className='py-2 pr-3'>Open %</th>
                  <th className='py-2 pr-3'>Over SLA</th>
                  <th className='py-2 pr-3'>QC</th>
                  <th className='py-2 pr-3'>Incident</th>
                  <th className='py-2 pr-3'>Cash Δ</th>
                  <th className='py-2'>Issue</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((r) => (
                  <tr key={r.summary_id} className='border-b last:border-0'>
                    <td className='py-2 pr-3 font-mono text-xs'>{r.date}</td>
                    <td className='py-2 pr-3'>{r.outlet_name || r.outlet_id}</td>
                    <td className='py-2 pr-3'>{r.opening_completion_percentage}%</td>
                    <td className='py-2 pr-3'>{r.orders_over_sla}</td>
                    <td className='py-2 pr-3'>{r.avg_qc_score}</td>
                    <td className='py-2 pr-3'>{r.incident_count}</td>
                    <td className='py-2 pr-3'>{formatIdr(r.cash_difference)}</td>
                    <td className='py-2 text-xs text-slate-600'>{r.major_ops_issue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = 'ok' }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${tone === 'warn' ? 'border-amber-300' : ''}`}>
      <div className='text-xs text-slate-500'>{label}</div>
      <div className='mt-1 text-2xl font-bold'>{value}</div>
    </div>
  );
}
