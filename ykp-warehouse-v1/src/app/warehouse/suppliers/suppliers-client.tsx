'use client';
import { useState } from 'react';

export default function SuppliersClient({
  suppliers, canWrite
}: {
  suppliers: Record<string, string>[];
  canWrite: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ supplier_code: '', supplier_name: '', item_category: '', phone: '', email: '', address: '', bank_name: '', bank_account: '', account_holder: '', lead_time_days: '1', minimum_order_value: '', preferred_delivery_day: '' });
  const [list, setList] = useState(suppliers);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    const r = await fetch('/api/warehouse/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([...list, j.data]);
    setShowForm(false);
    setForm({ supplier_code: '', supplier_name: '', item_category: '', phone: '', email: '', address: '', bank_name: '', bank_account: '', account_holder: '', lead_time_days: '1', minimum_order_value: '', preferred_delivery_day: '' });
  }

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className='space-y-3'>
      {canWrite && (
        <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
          {showForm ? 'Tutup' : '+ Tambah Supplier'}
        </button>
      )}
      {showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
            <input placeholder='Kode' value={form.supplier_code} onChange={(e) => update('supplier_code', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Nama Supplier *' value={form.supplier_name} onChange={(e) => update('supplier_name', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Kategori Item' value={form.item_category} onChange={(e) => update('item_category', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Telepon' value={form.phone} onChange={(e) => update('phone', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Email' value={form.email} onChange={(e) => update('email', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Alamat' value={form.address} onChange={(e) => update('address', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Bank' value={form.bank_name} onChange={(e) => update('bank_name', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='No Rekening' value={form.bank_account} onChange={(e) => update('bank_account', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Atas Nama' value={form.account_holder} onChange={(e) => update('account_holder', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Lead Time (hari)' value={form.lead_time_days} onChange={(e) => update('lead_time_days', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Min Order Value' value={form.minimum_order_value} onChange={(e) => update('minimum_order_value', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Delivery Day (1-7)' value={form.preferred_delivery_day} onChange={(e) => update('preferred_delivery_day', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
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
              <th className='px-2 py-1 text-left'>Kategori</th><th className='px-2 py-1 text-left'>Kontak</th>
              <th className='px-2 py-1 text-right'>Lead Time</th><th className='px-2 py-1 text-right'>Min Order</th>
              <th className='px-2 py-1 text-left'>Delivery Day</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.supplier_id} className='border-t border-border'>
                <td className='px-2 py-1 font-mono'>{s.supplier_code || s.supplier_id}</td>
                <td className='px-2 py-1'>{s.supplier_name}</td>
                <td className='px-2 py-1'>{s.item_category}</td>
                <td className='px-2 py-1'>{s.phone}{s.email ? ` / ${s.email}` : ''}</td>
                <td className='px-2 py-1 text-right'>{s.lead_time_days} h</td>
                <td className='px-2 py-1 text-right'>{formatRp(s.minimum_order_value)}</td>
                <td className='px-2 py-1'>{s.preferred_delivery_day || '-'}</td>
              </tr>
            ))}
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
