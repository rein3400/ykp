'use client';
import { useState } from 'react';

export default function ThresholdClient({
  thresholds, items, locations, canWrite
}: {
  thresholds: Record<string, string>[];
  items: Record<string, string>[];
  locations: Record<string, string>[];
  canWrite: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ threshold_type: '', brand_id: '', outlet_id: '', location_id: '', item_id: '', warning_value: '', high_value: '', critical_value: '', unit: '' });
  const [list, setList] = useState(thresholds);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    const r = await fetch('/api/warehouse/threshold', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([...list, j.data]);
    setShowForm(false);
    setForm({ threshold_type: '', brand_id: '', outlet_id: '', location_id: '', item_id: '', warning_value: '', high_value: '', critical_value: '', unit: '' });
  }

  return (
    <div className='space-y-3'>
      {canWrite && (
        <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
          {showForm ? 'Tutup' : '+ Tambah Threshold'}
        </button>
      )}
      {showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
            <input placeholder='Tipe *' value={form.threshold_type} onChange={(e) => setForm({ ...form, threshold_type: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Pilih Item</option>
              {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.item_name}</option>)}
            </select>
            <select value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Pilih Lokasi</option>
              {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
            </select>
            <input placeholder='Unit' value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Warning Value' value={form.warning_value} onChange={(e) => setForm({ ...form, warning_value: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='High Value' value={form.high_value} onChange={(e) => setForm({ ...form, high_value: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Critical Value' value={form.critical_value} onChange={(e) => setForm({ ...form, critical_value: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
          </div>
          {err && <p className='text-xs text-destructive'>{err}</p>}
          <button onClick={create} className='rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'>Simpan</button>
        </div>
      )}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Tipe</th><th className='px-2 py-1 text-left'>Item</th>
              <th className='px-2 py-1 text-left'>Lokasi</th><th className='px-2 py-1 text-right'>Warning</th>
              <th className='px-2 py-1 text-right'>High</th><th className='px-2 py-1 text-right'>Critical</th>
              <th className='px-2 py-1 text-left'>Unit</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.threshold_id} className='border-t border-border'>
                <td className='px-2 py-1'>{t.threshold_type}</td>
                <td className='px-2 py-1'>{items.find((i) => i.item_id === t.item_id)?.item_name ?? '-'}</td>
                <td className='px-2 py-1'>{locations.find((l) => l.location_id === t.location_id)?.location_name ?? '-'}</td>
                <td className='px-2 py-1 text-right'>{t.warning_value || '-'}</td>
                <td className='px-2 py-1 text-right'>{t.high_value || '-'}</td>
                <td className='px-2 py-1 text-right'>{t.critical_value || '-'}</td>
                <td className='px-2 py-1'>{t.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
