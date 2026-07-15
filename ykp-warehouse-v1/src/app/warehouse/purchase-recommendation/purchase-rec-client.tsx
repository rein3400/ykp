'use client';
import { useState } from 'react';

export default function PurchaseRecClient({
  recommendations
}: {
  recommendations: Record<string, string>[];
}) {
  const [list, setList] = useState(recommendations);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function regenerate() {
    setLoading(true); setErr(null);
    const r = await fetch('/api/warehouse/purchase-recommendation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList(j.data?.recommendations ?? []);
  }

  const sorted = [...list].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.priority as keyof typeof order] ?? 9) - (order[b.priority as keyof typeof order] ?? 9);
  });

  return (
    <div className='space-y-3'>
      <button onClick={regenerate} disabled={loading} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50'>
        {loading ? 'Generating…' : 'Generate Recommendations'}
      </button>
      {err && <p className='text-xs text-destructive'>{err}</p>}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Priority</th><th className='px-2 py-1 text-left'>Item</th>
              <th className='px-2 py-1 text-right'>Available</th><th className='px-2 py-1 text-right'>Days Cover</th>
              <th className='px-2 py-1 text-right'>Reorder</th><th className='px-2 py-1 text-right'>Suggested</th>
              <th className='px-2 py-1 text-right'>Est. Value</th><th className='px-2 py-1 text-left'>Supplier</th>
              <th className='px-2 py-1 text-left'>Reason</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.recommendation_id} className={`border-t border-border ${
                r.priority === 'CRITICAL' ? 'bg-red-50' : r.priority === 'HIGH' ? 'bg-orange-50' : ''
              }`}>
                <td className='px-2 py-1'><span className={`rounded px-1 text-[10px] font-medium ${
                  r.priority === 'CRITICAL' ? 'bg-red-200 text-red-900' :
                  r.priority === 'HIGH' ? 'bg-orange-200 text-orange-900' :
                  r.priority === 'MEDIUM' ? 'bg-yellow-200 text-yellow-900' :
                  'bg-gray-200 text-gray-700'
                }`}>{r.priority}</span></td>
                <td className='px-2 py-1 font-medium'>{r.item_name}</td>
                <td className='px-2 py-1 text-right'>{r.available_stock}</td>
                <td className='px-2 py-1 text-right'>{r.days_of_cover}</td>
                <td className='px-2 py-1 text-right'>{r.reorder_point}</td>
                <td className='px-2 py-1 text-right font-medium'>{r.rounded_purchase_qty} {r.purchase_unit}</td>
                <td className='px-2 py-1 text-right'>{formatRp(r.estimated_purchase_value)}</td>
                <td className='px-2 py-1'>{r.supplier_name || '-'}</td>
                <td className='px-2 py-1 text-muted-foreground text-[10px]'>{r.reason}</td>
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={9} className='px-2 py-3 text-center text-muted-foreground'>Belum ada recommendation. Klik Generate. Pastikan master item, average usage, lead time, stock opening terisi.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatRp(n: string) {
  const v = Number(n || 0);
  if (!v) return '-';
  return new Intl.NumberFormat('id-ID').format(v);
}
