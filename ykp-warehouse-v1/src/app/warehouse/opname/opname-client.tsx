'use client';
import { useState } from 'react';

export default function OpnameClient({
  headers, items, locations
}: {
  headers: Record<string, string>[];
  items: Record<string, string>[];
  locations: Record<string, string>[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ count_type: 'DAILY_CRITICAL', location_id: '', brand_id: '', outlet_id: '' });
  const [lineItems, setLineItems] = useState([{ item_id: '', physical_stock: '', base_unit: 'kg', notes: '' }]);
  const [list, setList] = useState(headers);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    const body = {
      ...form,
      items: lineItems.map((it) => ({
        item_id: it.item_id,
        physical_stock: Number(it.physical_stock || 0),
        base_unit: it.base_unit,
        notes: it.notes
      }))
    };
    const r = await fetch('/api/warehouse/stock-count', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([j.data.header, ...list]);
    setShowForm(false);
  }

  return (
    <div className='space-y-3'>
      <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
        {showForm ? 'Tutup' : '+ Stock Opname Baru'}
      </button>
      {err && <p className='text-xs text-destructive'>{err}</p>}
      {showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
            <select value={form.count_type} onChange={(e) => setForm({ ...form, count_type: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              {['DAILY_CRITICAL','WEEKLY','MONTHLY','SPOT_CHECK','RECOUNT'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Lokasi *</option>
              {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
            </select>
          </div>
          <p className='text-xs font-medium'>Items (physical stock)</p>
          {lineItems.map((it, idx) => (
            <div key={idx} className='grid grid-cols-3 gap-1'>
              <select value={it.item_id} onChange={(e) => { const c = [...lineItems]; c[idx] = { ...c[idx], item_id: e.target.value }; setLineItems(c); }} className='rounded border border-border px-1 py-0.5 text-[10px]'>
                <option value=''>Item</option>
                {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.item_name}</option>)}
              </select>
              <input placeholder='Physical Stock' value={it.physical_stock} onChange={(e) => { const c = [...lineItems]; c[idx] = { ...c[idx], physical_stock: e.target.value }; setLineItems(c); }} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Notes' value={it.notes} onChange={(e) => { const c = [...lineItems]; c[idx] = { ...c[idx], notes: e.target.value }; setLineItems(c); }} className='rounded border border-border px-1 py-0.5 text-[10px]' />
            </div>
          ))}
          <button onClick={() => setLineItems([...lineItems, { item_id: '', physical_stock: '', base_unit: 'kg', notes: '' }])} className='text-[10px] text-primary underline'>+ Item</button>
          <button onClick={create} className='rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'>Submit Opname</button>
        </div>
      )}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>ID</th><th className='px-2 py-1 text-left'>Tanggal</th>
              <th className='px-2 py-1 text-left'>Tipe</th><th className='px-2 py-1 text-left'>Lokasi</th>
              <th className='px-2 py-1 text-left'>Status</th><th className='px-2 py-1 text-left'>Counted By</th>
            </tr>
          </thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.count_id} className='border-t border-border'>
                <td className='px-2 py-1 font-mono text-[10px]'>{h.count_id}</td>
                <td className='px-2 py-1'>{h.count_date}</td>
                <td className='px-2 py-1'>{h.count_type?.replace(/_/g, ' ')}</td>
                <td className='px-2 py-1'>{locations.find((l) => l.location_id === h.location_id)?.location_name ?? '-'}</td>
                <td className='px-2 py-1'>{h.status}</td>
                <td className='px-2 py-1'>{h.counted_by}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className='px-2 py-3 text-center text-muted-foreground'>Belum ada stock opname. Book stock dihitung dari ledger.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
