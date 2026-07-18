'use client';
import { useState } from 'react';
import { EvidenceUpload, type EvidenceFile } from '@/components/evidence-upload';
import { EvidenceGallery } from '@/components/evidence-gallery';

export default function ReceivingClient({
  headers, items, suppliers, locations
}: {
  headers: Record<string, string>[];
  items: Record<string, string>[];
  suppliers: Record<string, string>[];
  locations: Record<string, string>[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    source_type: 'SUPPLIER', supplier_id: '', destination_location_id: '',
    purchase_order_id: '', invoice_number: '', delivery_note_number: '',
    received_by: '', verified_by: '', notes: ''
  });
  const [lineItems, setLineItems] = useState<Array<{
    item_id: string; batch_number: string; expiry_date: string;
    qty_ordered: string; qty_delivered: string; qty_accepted: string;
    unit: string; unit_price: string; condition_status: string;
    temperature_value: string; notes: string;
  }>>([{ item_id: '', batch_number: '', expiry_date: '', qty_ordered: '', qty_delivered: '', qty_accepted: '', unit: 'kg', unit_price: '', condition_status: 'GOOD', temperature_value: '', notes: '' }]);
  const [list, setList] = useState(headers);
  const [err, setErr] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);

  async function create() {
    setErr(null);
    const body = {
      ...form,
      evidence_urls: evidence,
      photo_url: evidence[0]?.url ?? '',
      items: lineItems.map((it) => ({
        item_id: it.item_id,
        batch_number: it.batch_number,
        expiry_date: it.expiry_date,
        qty_ordered: Number(it.qty_ordered || 0),
        qty_delivered: Number(it.qty_delivered || 0),
        qty_accepted: Number(it.qty_accepted || it.qty_delivered || 0),
        unit: it.unit,
        unit_price: Number(it.unit_price || 0),
        condition_status: it.condition_status,
        temperature_value: it.temperature_value,
        notes: it.notes
      }))
    };
    const r = await fetch('/api/warehouse/receiving', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([j.data.header, ...list]);
    setEvidence([]);
    setShowForm(false);
  }

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });
  const updateLine = (idx: number, k: string, v: string) => {
    const copy = [...lineItems];
    copy[idx] = { ...copy[idx], [k]: v };
    setLineItems(copy);
  };
  const addLine = () => setLineItems([...lineItems, { item_id: '', batch_number: '', expiry_date: '', qty_ordered: '', qty_delivered: '', qty_accepted: '', unit: 'kg', unit_price: '', condition_status: 'GOOD', temperature_value: '', notes: '' }]);

  return (
    <div className='space-y-3'>
      <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
        {showForm ? 'Tutup' : '+ Receiving Baru'}
      </button>
      {showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
            <select value={form.source_type} onChange={(e) => update('source_type', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              <option value='SUPPLIER'>Supplier</option><option value='CENTRAL_WAREHOUSE'>Gudang Pusat</option>
              <option value='OTHER_OUTLET'>Outlet Lain</option><option value='RETURN'>Return</option>
            </select>
            <select value={form.supplier_id} onChange={(e) => update('supplier_id', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Supplier</option>
              {suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
            </select>
            <select value={form.destination_location_id} onChange={(e) => update('destination_location_id', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Lokasi Tujuan</option>
              {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
            </select>
            <input placeholder='PO Number' value={form.purchase_order_id} onChange={(e) => update('purchase_order_id', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Invoice #' value={form.invoice_number} onChange={(e) => update('invoice_number', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Delivery Note #' value={form.delivery_note_number} onChange={(e) => update('delivery_note_number', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Received By' value={form.received_by} onChange={(e) => update('received_by', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Verified By' value={form.verified_by} onChange={(e) => update('verified_by', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
          </div>
          <p className='text-xs font-medium'>Line Items</p>
          {lineItems.map((it, idx) => (
            <div key={idx} className='grid grid-cols-2 gap-1 md:grid-cols-6 border-t border-border pt-1'>
              <select value={it.item_id} onChange={(e) => updateLine(idx, 'item_id', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]'>
                <option value=''>Item</option>
                {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.item_name}</option>)}
              </select>
              <input placeholder='Batch' value={it.batch_number} onChange={(e) => updateLine(idx, 'batch_number', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Expiry' type='date' value={it.expiry_date} onChange={(e) => updateLine(idx, 'expiry_date', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Qty Order' value={it.qty_ordered} onChange={(e) => updateLine(idx, 'qty_ordered', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Qty Delivered' value={it.qty_delivered} onChange={(e) => updateLine(idx, 'qty_delivered', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Qty Accepted' value={it.qty_accepted} onChange={(e) => updateLine(idx, 'qty_accepted', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Unit' value={it.unit} onChange={(e) => updateLine(idx, 'unit', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Unit Price' value={it.unit_price} onChange={(e) => updateLine(idx, 'unit_price', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <select value={it.condition_status} onChange={(e) => updateLine(idx, 'condition_status', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]'>
                {['GOOD','DAMAGED','EXPIRED','TEMPERATURE_ISSUE','WRONG_ITEM','WRONG_QTY','OTHER'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input placeholder='Temp' value={it.temperature_value} onChange={(e) => updateLine(idx, 'temperature_value', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
            </div>
          ))}
          <button onClick={addLine} className='text-[10px] text-primary underline'>+ Tambah Item</button>
          <EvidenceUpload
            transactionType="receiving"
            value={evidence}
            onChange={setEvidence}
            label="Bukti Foto/Video Receiving"
          />
          {err && <p className='text-xs text-destructive'>{err}</p>}
          <button onClick={create} className='rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'>Simpan Receiving</button>
        </div>
      )}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>ID</th><th className='px-2 py-1 text-left'>Tanggal</th>
              <th className='px-2 py-1 text-left'>Source</th><th className='px-2 py-1 text-left'>Supplier</th>
              <th className='px-2 py-1 text-left'>Lokasi</th><th className='px-2 py-1 text-left'>Status</th>
              <th className='px-2 py-1 text-left'>PO/Invoice</th>
              <th className='px-2 py-1 text-left'>Bukti</th>
            </tr>
          </thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.receiving_id} className='border-t border-border'>
                <td className='px-2 py-1 font-mono text-[10px]'>{h.receiving_id}</td>
                <td className='px-2 py-1'>{h.date}</td>
                <td className='px-2 py-1'>{h.source_type}</td>
                <td className='px-2 py-1'>{suppliers.find((s) => s.supplier_id === h.supplier_id)?.supplier_name ?? '-'}</td>
                <td className='px-2 py-1'>{locations.find((l) => l.location_id === h.destination_location_id)?.location_name ?? '-'}</td>
                <td className='px-2 py-1'><span className={`rounded px-1 text-[10px] font-medium ${h.receiving_status === 'RECEIVED' ? 'bg-green-100 text-green-800' : h.receiving_status === 'DISCREPANCY' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{h.receiving_status}</span></td>
                <td className='px-2 py-1 text-[10px]'>{h.purchase_order_id || '-'} / {h.invoice_number || '-'}</td>
                <td className='px-2 py-1'>
                  {h.photo_url ? (
                    <EvidenceGallery files={[{ url: h.photo_url, path: h.photo_url, media_type: 'image' }]} />
                  ) : (
                    <span className='text-[10px] text-muted-foreground'>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
