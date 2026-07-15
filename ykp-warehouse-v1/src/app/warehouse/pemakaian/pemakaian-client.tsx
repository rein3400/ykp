'use client';
import { useState } from 'react';

export default function PemakaianClient({
  rows, items, outlets
}: {
  rows: Record<string, string>[];
  items: Record<string, string>[];
  outlets: Record<string, string>[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ outlet_id: '', item_id: '', qty_out: '', unit: 'kg', for_menu: '', requested_by: '', approved_by_pic: '', shift: '' });
  const [list, setList] = useState(rows);
  const [err, setErr] = useState<string | null>(null);
  const selectedItem = items.find((i) => i.item_id === form.item_id);

  async function create() {
    setErr(null);
    const body = { ...form, item_name: selectedItem?.item_name ?? '', unit: form.unit || selectedItem?.unit || 'kg' };
    const r = await fetch('/api/warehouse/pemakaian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([j.data, ...list]);
    setShowForm(false);
  }

  return (
    <div className='space-y-3'>
      <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
        {showForm ? 'Tutup' : '+ Bon Pemakaian'}
      </button>
      {showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
            <select value={form.outlet_id} onChange={(e) => setForm({ ...form, outlet_id: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Outlet</option>
              {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
            </select>
            <select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value, unit: items.find((i) => i.item_id === e.target.value)?.unit ?? 'kg' })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Item</option>
              {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.item_name}</option>)}
            </select>
            <input placeholder='Qty Keluar' value={form.qty_out} onChange={(e) => setForm({ ...form, qty_out: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Satuan' value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Untuk Menu/Keperluan' value={form.for_menu} onChange={(e) => setForm({ ...form, for_menu: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Diminta Oleh' value={form.requested_by} onChange={(e) => setForm({ ...form, requested_by: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Disetujui PIC' value={form.approved_by_pic} onChange={(e) => setForm({ ...form, approved_by_pic: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Shift' value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
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
              <th className='px-2 py-1 text-left'>Item</th><th className='px-2 py-1 text-right'>Qty Keluar</th>
              <th className='px-2 py-1 text-left'>Untuk</th><th className='px-2 py-1 text-left'>Diminta</th>
              <th className='px-2 py-1 text-left'>Disetujui</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.usage_id} className='border-t border-border'>
                <td className='px-2 py-1'>{r.date} {r.time}</td>
                <td className='px-2 py-1'>{r.outlet_id}</td>
                <td className='px-2 py-1'>{r.item_name}</td>
                <td className='px-2 py-1 text-right'>{r.qty_out} {r.unit}</td>
                <td className='px-2 py-1'>{r.for_menu}</td>
                <td className='px-2 py-1'>{r.requested_by}</td>
                <td className='px-2 py-1'>{r.approved_by_pic}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className='px-2 py-3 text-center text-muted-foreground'>Belum ada bon pemakaian.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}