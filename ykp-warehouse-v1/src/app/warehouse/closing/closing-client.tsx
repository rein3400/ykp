'use client';
import { useState } from 'react';

export default function ClosingClient({
  rows, items, outlets
}: {
  rows: Record<string, string>[];
  items: Record<string, string>[];
  outlets: Record<string, string>[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ outlet_id: '', item_id: '', stock_open: '', received: '', used: '', waste: '', actual_stock: '', shift: '', pic_stock: '' });
  const [list, setList] = useState(rows);
  const [err, setErr] = useState<string | null>(null);
  const selectedItem = items.find((i) => i.item_id === form.item_id);

  async function create() {
    setErr(null);
    const body = { ...form, item_name: selectedItem?.item_name ?? '', unit: selectedItem?.unit ?? 'kg' };
    const r = await fetch('/api/warehouse/closing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([j.data, ...list]);
    setShowForm(false);
  }

  return (
    <div className='space-y-3'>
      <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
        {showForm ? 'Tutup' : '+ Catat Closing'}
      </button>
      {showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
            <select value={form.outlet_id} onChange={(e) => setForm({ ...form, outlet_id: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Outlet</option>
              {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
            </select>
            <select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Item</option>
              {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.item_name}</option>)}
            </select>
            <input placeholder='Stok Awal' value={form.stock_open} onChange={(e) => setForm({ ...form, stock_open: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Penerimaan' value={form.received} onChange={(e) => setForm({ ...form, received: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Pemakaian' value={form.used} onChange={(e) => setForm({ ...form, used: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Waste' value={form.waste} onChange={(e) => setForm({ ...form, waste: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Stok Aktual' value={form.actual_stock} onChange={(e) => setForm({ ...form, actual_stock: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Shift' value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='PIC Stok' value={form.pic_stock} onChange={(e) => setForm({ ...form, pic_stock: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
          </div>
          {err && <p className='text-xs text-destructive'>{err}</p>}
          <button onClick={create} className='rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'>Simpan</button>
        </div>
      )}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Tanggal</th><th className='px-2 py-1 text-left'>Item</th>
              <th className='px-2 py-1 text-right'>Awal</th><th className='px-2 py-1 text-right'>Terima</th>
              <th className='px-2 py-1 text-right'>Pakai</th><th className='px-2 py-1 text-right'>Waste</th>
              <th className='px-2 py-1 text-right'>Expected</th><th className='px-2 py-1 text-right'>Aktual</th>
              <th className='px-2 py-1 text-right'>Selisih</th><th className='px-2 py-1 text-right'>%</th>
              <th className='px-2 py-1 text-center'>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const pct = Number(r.diff_pct || 0);
              const alert = pct > 5;
              return (
                <tr key={r.closing_id} className={`border-t border-border ${alert ? 'bg-destructive/10' : ''}`}>
                  <td className='px-2 py-1'>{r.date}</td>
                  <td className='px-2 py-1'>{r.item_name}</td>
                  <td className='px-2 py-1 text-right'>{r.stock_open}</td>
                  <td className='px-2 py-1 text-right'>{r.received}</td>
                  <td className='px-2 py-1 text-right'>{r.used}</td>
                  <td className='px-2 py-1 text-right'>{r.waste}</td>
                  <td className='px-2 py-1 text-right'>{r.expected_stock}</td>
                  <td className='px-2 py-1 text-right font-medium'>{r.actual_stock}</td>
                  <td className='px-2 py-1 text-right'>{r.difference}</td>
                  <td className='px-2 py-1 text-right'>{r.diff_pct}%</td>
                  <td className='px-2 py-1 text-center'>
                    <span className={alert ? 'font-semibold text-destructive' : 'text-success'}>{r.status}</span>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={11} className='px-2 py-3 text-center text-muted-foreground'>Belum ada closing.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}