'use client';
import { useState } from 'react';
import { EvidenceUpload, type EvidenceFile } from '@/components/evidence-upload';

export default function TransferClient({
  headers, items, locations
}: {
  headers: Record<string, string>[];
  items: Record<string, string>[];
  locations: Record<string, string>[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ source_location_id: '', destination_location_id: '', notes: '' });
  const [lineItems, setLineItems] = useState([{ item_id: '', requested_qty: '', unit: 'kg' }]);
  const [list, setList] = useState(headers);
  const [err, setErr] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);

  async function create() {
    setErr(null);
    const body = {
      ...form,
      evidence_urls: evidence,
      items: lineItems.map((it) => ({ item_id: it.item_id, requested_qty: Number(it.requested_qty || 0), unit: it.unit }))
    };
    const r = await fetch('/api/warehouse/transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([j.data.header, ...list]);
    setEvidence([]);
    setShowForm(false);
  }

  async function doAction(transferId: string, action: string) {
    const r = await fetch('/api/warehouse/transfer', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transfer_id: transferId, action })
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList(list.map((h) => h.transfer_id === transferId ? j.data : h));
  }

  return (
    <div className='space-y-3'>
      <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
        {showForm ? 'Tutup' : '+ Transfer Baru'}
      </button>
      {err && <p className='text-xs text-destructive'>{err}</p>}
      {showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
            <select value={form.source_location_id} onChange={(e) => setForm({ ...form, source_location_id: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Lokasi Sumber</option>
              {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
            </select>
            <select value={form.destination_location_id} onChange={(e) => setForm({ ...form, destination_location_id: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Lokasi Tujuan</option>
              {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
            </select>
            <input placeholder='Notes' value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
          </div>
          {lineItems.map((it, idx) => (
            <div key={idx} className='grid grid-cols-3 gap-1'>
              <select value={it.item_id} onChange={(e) => { const c = [...lineItems]; c[idx] = { ...c[idx], item_id: e.target.value }; setLineItems(c); }} className='rounded border border-border px-1 py-0.5 text-[10px]'>
                <option value=''>Item</option>
                {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.item_name}</option>)}
              </select>
              <input placeholder='Qty' value={it.requested_qty} onChange={(e) => { const c = [...lineItems]; c[idx] = { ...c[idx], requested_qty: e.target.value }; setLineItems(c); }} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Unit' value={it.unit} onChange={(e) => { const c = [...lineItems]; c[idx] = { ...c[idx], unit: e.target.value }; setLineItems(c); }} className='rounded border border-border px-1 py-0.5 text-[10px]' />
            </div>
          ))}
          <button onClick={() => setLineItems([...lineItems, { item_id: '', requested_qty: '', unit: 'kg' }])} className='text-[10px] text-primary underline'>+ Item</button>
          <EvidenceUpload
            transactionType="transfer"
            value={evidence}
            onChange={setEvidence}
            label="Bukti Foto/Video Transfer"
          />
          <button onClick={create} className='rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'>Request Transfer</button>
        </div>
      )}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>ID</th><th className='px-2 py-1 text-left'>Tanggal</th>
              <th className='px-2 py-1 text-left'>Sumber</th><th className='px-2 py-1 text-left'>Tujuan</th>
              <th className='px-2 py-1 text-left'>Status</th><th className='px-2 py-1 text-left'>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.transfer_id} className='border-t border-border'>
                <td className='px-2 py-1 font-mono text-[10px]'>{h.transfer_id}</td>
                <td className='px-2 py-1'>{h.date}</td>
                <td className='px-2 py-1'>{locations.find((l) => l.location_id === h.source_location_id)?.location_name ?? '-'}</td>
                <td className='px-2 py-1'>{locations.find((l) => l.location_id === h.destination_location_id)?.location_name ?? '-'}</td>
                <td className='px-2 py-1'><span className={`rounded px-1 text-[10px] font-medium ${
                  h.status === 'RECEIVED' ? 'bg-green-100 text-green-800' :
                  h.status === 'DISCREPANCY' ? 'bg-red-100 text-red-800' :
                  h.status === 'DISPATCHED' ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>{h.status}</span></td>
                <td className='px-2 py-1'>
                  <div className='flex gap-1'>
                    {h.status === 'REQUESTED' && <button onClick={() => doAction(h.transfer_id, 'approve')} className='rounded bg-green-500 px-1.5 py-0.5 text-[10px] text-white'>Approve</button>}
                    {h.status === 'APPROVED' && <button onClick={() => doAction(h.transfer_id, 'dispatch')} className='rounded bg-blue-500 px-1.5 py-0.5 text-[10px] text-white'>Dispatch</button>}
                    {h.status === 'DISPATCHED' && <button onClick={() => doAction(h.transfer_id, 'receive')} className='rounded bg-green-500 px-1.5 py-0.5 text-[10px] text-white'>Receive</button>}
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className='px-2 py-3 text-center text-muted-foreground'>Belum ada transfer.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
