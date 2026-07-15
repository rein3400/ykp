'use client';
import { useState } from 'react';

const ITEM_TYPES = ['RAW_MATERIAL','PACKAGING','FINISHED_GOOD','SEMI_FINISHED','CLEANING_SUPPLY','EQUIPMENT_CONSUMABLE','OTHER'];
const CRITICALITY = ['LOW','MEDIUM','HIGH','CRITICAL'];

export default function ItemsClient({
  items,
  categories,
  suppliers,
  canWrite
}: {
  items: Record<string, string>[];
  categories: Record<string, string>[];
  suppliers: Record<string, string>[];
  canWrite: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    item_code: '', item_name: '', brand_id: '', category_id: '',
    item_type: 'RAW_MATERIAL', base_unit: 'kg', purchase_unit: 'kg', conversion_factor: '1',
    pack_size: '1', minimum_order_quantity: '1', preferred_supplier_id: '',
    latest_purchase_price: '', average_purchase_price: '',
    minimum_stock: '', safety_stock: '', maximum_stock: '', reorder_point: '',
    average_daily_usage: '', supplier_lead_time_days: '1', supplier_order_day: '', supplier_delivery_day: '',
    expiry_days: '0', criticality: 'MEDIUM', tolerance_variance_percentage: '5', tolerance_variance_value: '',
    recipe_linked_status: 'NO'
  });
  const [list, setList] = useState(items);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    const r = await fetch('/api/warehouse/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([...list, j.data]);
    setShowForm(false);
    setForm({
      item_code: '', item_name: '', brand_id: '', category_id: '',
      item_type: 'RAW_MATERIAL', base_unit: 'kg', purchase_unit: 'kg', conversion_factor: '1',
      pack_size: '1', minimum_order_quantity: '1', preferred_supplier_id: '',
      latest_purchase_price: '', average_purchase_price: '',
      minimum_stock: '', safety_stock: '', maximum_stock: '', reorder_point: '',
      average_daily_usage: '', supplier_lead_time_days: '1', supplier_order_day: '', supplier_delivery_day: '',
      expiry_days: '0', criticality: 'MEDIUM', tolerance_variance_percentage: '5', tolerance_variance_value: '',
      recipe_linked_status: 'NO'
    });
  }

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className='space-y-3'>
      {canWrite && (
        <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
          {showForm ? 'Tutup' : '+ Tambah Item'}
        </button>
      )}
      {showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <p className='text-xs font-medium'>Data Dasar</p>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
            <input placeholder='Kode' value={form.item_code} onChange={(e) => update('item_code', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Nama Item *' value={form.item_name} onChange={(e) => update('item_name', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <select value={form.category_id} onChange={(e) => update('category_id', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Pilih Kategori</option>
              {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
            </select>
            <select value={form.item_type} onChange={(e) => update('item_type', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              {ITEM_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <input placeholder='Unit Dasar *' value={form.base_unit} onChange={(e) => update('base_unit', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Unit Beli' value={form.purchase_unit} onChange={(e) => update('purchase_unit', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Conversion Factor' value={form.conversion_factor} onChange={(e) => update('conversion_factor', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Pack Size' value={form.pack_size} onChange={(e) => update('pack_size', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='MOQ' value={form.minimum_order_quantity} onChange={(e) => update('minimum_order_quantity', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <select value={form.preferred_supplier_id} onChange={(e) => update('preferred_supplier_id', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Supplier Utama</option>
              {suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
            </select>
          </div>
          <p className='text-xs font-medium'>Stok &amp; Pembelian</p>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-5'>
            <input placeholder='Harga Beli Terakhir' value={form.latest_purchase_price} onChange={(e) => update('latest_purchase_price', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Avg Harga Beli' value={form.average_purchase_price} onChange={(e) => update('average_purchase_price', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Min Stock' value={form.minimum_stock} onChange={(e) => update('minimum_stock', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Safety Stock' value={form.safety_stock} onChange={(e) => update('safety_stock', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Max Stock' value={form.maximum_stock} onChange={(e) => update('maximum_stock', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Reorder Point' value={form.reorder_point} onChange={(e) => update('reorder_point', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Avg Daily Usage' value={form.average_daily_usage} onChange={(e) => update('average_daily_usage', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Lead Time (hari)' value={form.supplier_lead_time_days} onChange={(e) => update('supplier_lead_time_days', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Order Day (1-7)' value={form.supplier_order_day} onChange={(e) => update('supplier_order_day', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Delivery Day (1-7)' value={form.supplier_delivery_day} onChange={(e) => update('supplier_delivery_day', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Expiry Days' value={form.expiry_days} onChange={(e) => update('expiry_days', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <select value={form.criticality} onChange={(e) => update('criticality', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              {CRITICALITY.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder='Tolerance %' value={form.tolerance_variance_percentage} onChange={(e) => update('tolerance_variance_percentage', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Tolerance Value' value={form.tolerance_variance_value} onChange={(e) => update('tolerance_variance_value', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <select value={form.recipe_linked_status} onChange={(e) => update('recipe_linked_status', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              <option value='NO'>No Recipe</option>
              <option value='YES'>Linked Recipe</option>
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
              <th className='px-2 py-1 text-left'>Kode</th>
              <th className='px-2 py-1 text-left'>Nama</th>
              <th className='px-2 py-1 text-left'>Kategori</th>
              <th className='px-2 py-1 text-left'>Unit</th>
              <th className='px-2 py-1 text-right'>Avg Harga</th>
              <th className='px-2 py-1 text-right'>Min/Safety/Max</th>
              <th className='px-2 py-1 text-right'>Reorder</th>
              <th className='px-2 py-1 text-right'>Lead Time</th>
              <th className='px-2 py-1 text-left'>Criticality</th>
            </tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.item_id} className='border-t border-border'>
                <td className='px-2 py-1 font-mono'>{i.item_id}</td>
                <td className='px-2 py-1'>{i.item_name}</td>
                <td className='px-2 py-1'>{categoryName(categories, i.category_id)}</td>
                <td className='px-2 py-1'>{i.base_unit}</td>
                <td className='px-2 py-1 text-right'>{formatRp(i.average_purchase_price)}</td>
                <td className='px-2 py-1 text-right'>{`${i.minimum_stock}/${i.safety_stock}/${i.maximum_stock}`}</td>
                <td className='px-2 py-1 text-right'>{i.reorder_point}</td>
                <td className='px-2 py-1 text-right'>{i.supplier_lead_time_days} h</td>
                <td className='px-2 py-1'>{i.criticality}</td>
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

function categoryName(categories: Record<string,string>[], id: string) {
  return categories.find((c) => c.category_id === id)?.category_name ?? id ?? '-';
}
