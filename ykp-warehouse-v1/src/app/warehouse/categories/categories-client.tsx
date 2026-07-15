'use client';
import { useState } from 'react';

export default function CategoriesClient({
  categories, canWrite
}: {
  categories: Record<string, string>[];
  canWrite: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ category_name: '', parent_category_id: '' });
  const [list, setList] = useState(categories);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    const r = await fetch('/api/warehouse/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([...list, j.data]);
    setShowForm(false);
    setForm({ category_name: '', parent_category_id: '' });
  }

  return (
    <div className='space-y-3'>
      {canWrite && (
        <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
          {showForm ? 'Tutup' : '+ Tambah Kategori'}
        </button>
      )}
      {showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <div className='flex gap-2'>
            <input placeholder='Nama Kategori *' value={form.category_name} onChange={(e) => setForm({ ...form, category_name: e.target.value })} className='rounded border border-border px-2 py-1 text-xs flex-1' />
            <select value={form.parent_category_id} onChange={(e) => setForm({ ...form, parent_category_id: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>No Parent</option>
              {list.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
            </select>
          </div>
          {err && <p className='text-xs text-destructive'>{err}</p>}
          <button onClick={create} className='rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'>Simpan</button>
        </div>
      )}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>ID</th><th className='px-2 py-1 text-left'>Nama</th>
              <th className='px-2 py-1 text-left'>Parent</th><th className='px-2 py-1 text-left'>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.category_id} className='border-t border-border'>
                <td className='px-2 py-1 font-mono'>{c.category_id}</td>
                <td className='px-2 py-1'>{c.category_name}</td>
                <td className='px-2 py-1'>{list.find((p) => p.category_id === c.parent_category_id)?.category_name ?? '-'}</td>
                <td className='px-2 py-1'>{c.active_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
