import { readTab, TABS } from '@/db/sheets';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function KdsPage() {
  const orders = await readTab(TABS.kds);
  const over = orders.filter((r) => r.sla_status === 'OVER_SLA' || r.sla_status === 'CRITICAL_DELAY').length;
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>KDS / Live Ops</h1>
        <p className='text-sm text-slate-500'>Antrean order statis V1. Timer serving dihitung manual.</p>
      </div>
      <div className='grid gap-4 sm:grid-cols-3'>
        <Kpi label='Queued' value={String(orders.filter((r) => r.status === 'QUEUED').length)} />
        <Kpi label='Cooking' value={String(orders.filter((r) => r.status === 'COOKING').length)} />
        <Kpi label='Over SLA' value={String(over)} tone={over > 0 ? 'warn' : 'ok'} />
      </div>
      <Link href='/api/ops/kds' className='inline-block rounded-lg border bg-white px-3 py-1.5 text-sm'>Mock: submit test order</Link>
      <div className='rounded-xl border bg-white p-4'>
        <h2 className='mb-3 font-semibold'>Orders</h2>
        {orders.length === 0 ? (
          <p className='text-sm text-slate-500'>Belum ada order. POST /api/ops/kds untuk seed order uji.</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead className='border-b text-xs text-slate-500'>
                <tr>
                  <th className='py-2 pr-3'>Order</th>
                  <th className='py-2 pr-3'>Status</th>
                  <th className='py-2 pr-3'>Serve (s)</th>
                  <th className='py-2 pr-3'>SLA</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice().reverse().map((r) => (
                  <tr key={r.order_id} className='border-b last:border-0'>
                    <td className='py-2 pr-3'>{r.menu_items}</td>
                    <td className='py-2 pr-3'>
                      <span className={`rounded px-2 py-0.5 text-xs ${r.sla_status === 'CRITICAL_DELAY' ? 'bg-red-100 text-red-700' : r.sla_status === 'OVER_SLA' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className='py-2 pr-3'>{r.serving_seconds}</td>
                    <td className='py-2 pr-3'>{r.sla_status}</td>
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
