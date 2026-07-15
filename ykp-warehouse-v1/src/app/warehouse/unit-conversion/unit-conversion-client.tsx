'use client';
import { useState } from 'react';

export default function UnitConversionClient({
  conversions, items, canWrite
}: {
  conversions: Record<string, string>[];
  items: Record<string, string>[];
  canWrite: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ item_id: '', from_unit: '', to_unit: '', conversion_factor: '' });
  const [list, setList] = useState(conversions);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    const r = await fetch('/api/warehouse/unit-conversion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([...list, j.data]);
    setShowForm(false);
    setForm({ item_id: '', from_unit: '', to_unit: '', conversion_factor: '' });
  }

  return (
    <div className='space-y-3'>
      {canWrite && (
        <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
          {showForm ? 'Tutup' : '+ Tambah Konversi'}
        </button>
      )}
      {showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
            <select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Pilih Item *</option>
              {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.item_name}</option>)}
            </select>
            <input placeholder='Dari Unit *' value={form.from_unit} onChange={(e) => setForm({ ...form, from_unit: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Ke Unit *' value={form.to_unit} onChange={(e) => setForm({ ...form, to_unit: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Faktor *' value={form.conversion_factor} onChange={(e) => setForm({ ...form, conversion_factor: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
          </div>
          {err && <p className='text-xs text-destructive'>{err}</p>}
          <button onClick={create} className='rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'>Simpan</button>
        </div>
      )}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Item</th><th className='px-2 py-1 text-left'>Dari</th>
              <th className='px-2 py-1 text-left'>Ke</th><th className='px-2 py-1 text-right'>Faktor</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.conversion_id} className='border-t border-border'>
                <td className='px-2 py-1'>{items.find((i) => i.item_id === c.item_id)?.item_name ?? c.item_id}</td>
                <td className='px-2 py-1'>{c.from_unit}</td>
                <td className='px-2 py-1'>{c.to_unit}</td>
                <td className='px-2 py-1 text-right'>{c.conversion_factor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
