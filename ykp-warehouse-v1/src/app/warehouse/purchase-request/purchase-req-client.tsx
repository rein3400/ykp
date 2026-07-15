'use client';
import { useState } from 'react';

export default function PurchaseReqClient({
  requests, recommendations
}: {
  requests: Record<string, string>[];
  recommendations: Record<string, string>[];
}) {
  const [list, setList] = useState(requests);
  const [err, setErr] = useState<string | null>(null);

  const newRecs = recommendations.filter((r) => r.recommendation_status === 'NEW' && (r.priority === 'CRITICAL' || r.priority === 'HIGH'));

  async function createFromRecs() {
    setErr(null);
    if (newRecs.length === 0) { setErr('Tidak ada CRITICAL/HIGH recommendation NEW'); return; }
    const r = await fetch('/api/warehouse/purchase-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendation_ids: newRecs.map((rec) => rec.recommendation_id), priority: 'HIGH' })
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([j.data.header, ...list]);
  }

  async function doAction(prId: string, action: string) {
    const r = await fetch('/api/warehouse/purchase-request', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchase_request_id: prId, action })
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList(list.map((h) => h.purchase_request_id === prId ? j.data : h));
  }

  return (
    <div className='space-y-3'>
      <button onClick={createFromRecs} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
        Buat PR dari {newRecs.length} CRITICAL/HIGH Rec
      </button>
      {err && <p className='text-xs text-destructive'>{err}</p>}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>ID</th><th className='px-2 py-1 text-left'>Tanggal</th>
              <th className='px-2 py-1 text-left'>Priority</th><th className='px-2 py-1 text-right'>Est. Value</th>
              <th className='px-2 py-1 text-left'>Status</th><th className='px-2 py-1 text-left'>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.purchase_request_id} className='border-t border-border'>
                <td className='px-2 py-1 font-mono text-[10px]'>{h.purchase_request_id}</td>
                <td className='px-2 py-1'>{h.date}</td>
                <td className='px-2 py-1'>{h.priority}</td>
                <td className='px-2 py-1 text-right'>{formatRp(h.estimated_total_value)}</td>
                <td className='px-2 py-1'><span className={`rounded px-1 text-[10px] font-medium ${
                  h.status === 'APPROVED' || h.status === 'ORDERED' ? 'bg-green-100 text-green-800' :
                  h.status === 'REJECTED' || h.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>{h.status}</span></td>
                <td className='px-2 py-1'>
                  <div className='flex gap-1'>
                    {h.status === 'SUBMITTED' && (
                      <>
                        <button onClick={() => doAction(h.purchase_request_id, 'approve')} className='rounded bg-green-500 px-1.5 py-0.5 text-[10px] text-white'>Approve</button>
                        <button onClick={() => doAction(h.purchase_request_id, 'reject')} className='rounded bg-red-500 px-1.5 py-0.5 text-[10px] text-white'>Reject</button>
                      </>
                    )}
                    {h.status === 'APPROVED' && <button onClick={() => doAction(h.purchase_request_id, 'order')} className='rounded bg-blue-500 px-1.5 py-0.5 text-[10px] text-white'>Order</button>}
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className='px-2 py-3 text-center text-muted-foreground'>Belum ada purchase request.</td></tr>}
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
