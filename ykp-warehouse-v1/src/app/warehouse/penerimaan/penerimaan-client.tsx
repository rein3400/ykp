'use client';
import { useState } from 'react';

export default function PenerimaanClient({
  rows, items, outlets
}: {
  rows: Record<string, string>[];
  items: Record<string, string>[];
  outlets: Record<string, string>[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ outlet_id: '', po_number: '', supplier_id: '', item_id: '', qty_order: '', qty_received: '', unit: 'kg', condition: '', signed_by: '' });
  const [list, setList] = useState(rows);
  const [err, setErr] = useState<string | null>(null);

  const selectedItem = items.find((i) => i.item_id === form.item_id);

  async function create() {
    setErr(null);
    const body = {
      ...form,
      item_name: selectedItem?.item_name ?? '',
      unit: form.unit || selectedItem?.unit || 'kg'
    };
    const r = await fetch('/api/warehouse/penerimaan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([j.data, ...list]);
    setShowForm(false);
  }

  return (
    <div className='space-y-3'>
      <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
        {showForm ? 'Tutup' : '+ Catat Penerimaan'}
      </button>
      {showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
            <select value={form.outlet_id} onChange={(e) => setForm({ ...form, outlet_id: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Pilih Outlet</option>
              {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
            </select>
            <input placeholder='No. PO/DO' value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Supplier ID' value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value, unit: items.find((i) => i.item_id === e.target.value)?.unit ?? 'kg' })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Pilih Item</option>
              {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.item_name}</option>)}
            </select>
            <input placeholder='Qty Pesan' value={form.qty_order} onChange={(e) => setForm({ ...form, qty_order: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Qty Terima' value={form.qty_received} onChange={(e) => setForm({ ...form, qty_received: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Satuan' value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Kondisi' value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='TTD Pengirim & Penerima' value={form.signed_by} onChange={(e) => setForm({ ...form, signed_by: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
          </div>
          {err && <p className='text-xs text-destructive'>{err}</p>}
          <button onClick={create} className='rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'>Simpan</button>
        </div>
      )}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Tanggal</th><th className='px-2 py-1 text-left'>Outlet</th>
              <th className='px-2 py-1 text-left'>Item</th><th className='px-2 py-1 text-right'>Pesan</th>
              <th className='px-2 py-1 text-right'>Terima</th><th className='px-2 py-1 text-right'>Selisih</th>
              <th className='px-2 py-1 text-left'>Kondisi</th><th className='px-2 py-1 text-left'>TTD</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const diff = Number(r.difference || 0);
              return (
                <tr key={r.receive_id} className={`border-t border-border ${diff > 0 ? 'bg-warning/10' : ''}`}>
                  <td className='px-2 py-1'>{r.date} {r.time}</td>
                  <td className='px-2 py-1'>{r.outlet_id}</td>
                  <td className='px-2 py-1'>{r.item_name}</td>
                  <td className='px-2 py-1 text-right'>{r.qty_order} {r.unit}</td>
                  <td className='px-2 py-1 text-right'>{r.qty_received} {r.unit}</td>
                  <td className='px-2 py-1 text-right'>{diff}</td>
                  <td className='px-2 py-1'>{r.condition}</td>
                  <td className='px-2 py-1 text-muted-foreground'>{r.signed_by}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}