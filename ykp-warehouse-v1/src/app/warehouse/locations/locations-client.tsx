'use client';
import { useState } from 'react';

const LOCATION_TYPES = ['CENTRAL_WAREHOUSE','OUTLET_WAREHOUSE','KITCHEN','BAR','CHILLER','FREEZER','DRY_STORAGE','OTHER'];

export default function LocationsClient({
  locations, brands, outlets, canWrite
}: {
  locations: Record<string, string>[];
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
  canWrite: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ location_code: '', location_name: '', brand_id: '', outlet_id: '', location_type: 'CENTRAL_WAREHOUSE', parent_location_id: '', address: '' });
  const [list, setList] = useState(locations);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    const r = await fetch('/api/warehouse/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([...list, j.data]);
    setShowForm(false);
    setForm({ location_code: '', location_name: '', brand_id: '', outlet_id: '', location_type: 'CENTRAL_WAREHOUSE', parent_location_id: '', address: '' });
  }

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className='space-y-3'>
      {canWrite && (
        <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
          {showForm ? 'Tutup' : '+ Tambah Lokasi'}
        </button>
      )}
      {showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
            <input placeholder='Kode' value={form.location_code} onChange={(e) => update('location_code', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Nama Lokasi *' value={form.location_name} onChange={(e) => update('location_name', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <select value={form.brand_id} onChange={(e) => update('brand_id', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Pilih Brand</option>
              {brands.map((b) => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
            </select>
            <select value={form.outlet_id} onChange={(e) => update('outlet_id', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Pilih Outlet</option>
              {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
            </select>
            <select value={form.location_type} onChange={(e) => update('location_type', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <input placeholder='Parent Location ID' value={form.parent_location_id} onChange={(e) => update('parent_location_id', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Alamat' value={form.address} onChange={(e) => update('address', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
          </div>
          {err && <p className='text-xs text-destructive'>{err}</p>}
          <button onClick={create} className='rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'>Simpan</button>
        </div>
      )}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Kode</th><th className='px-2 py-1 text-left'>Nama</th>
              <th className='px-2 py-1 text-left'>Brand</th><th className='px-2 py-1 text-left'>Outlet</th>
              <th className='px-2 py-1 text-left'>Tipe</th><th className='px-2 py-1 text-left'>Parent</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.location_id} className='border-t border-border'>
                <td className='px-2 py-1 font-mono'>{l.location_code}</td>
                <td className='px-2 py-1'>{l.location_name}</td>
                <td className='px-2 py-1'>{brands.find((b) => b.brand_id === l.brand_id)?.brand_name ?? '-'}</td>
                <td className='px-2 py-1'>{outlets.find((o) => o.outlet_id === l.outlet_id)?.outlet_name ?? '-'}</td>
                <td className='px-2 py-1'>{l.location_type?.replace(/_/g, ' ')}</td>
                <td className='px-2 py-1'>{l.parent_location_id || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
