'use client';
import { Fragment, useState } from 'react';
import { SearchableSelect } from '@/components/searchable-select';
import { EvidenceUpload, type EvidenceFile } from '@/components/evidence-upload';
import { EvidenceGallery } from '@/components/evidence-gallery';

export default function ReceivingClient({
  headers, items, suppliers, locations, canCreate
}: {
  headers: Record<string, string>[];
  items: Record<string, string>[];
  suppliers: Record<string, string>[];
  locations: Record<string, string>[];
  canCreate: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    source_type: 'SUPPLIER', supplier_id: '', destination_location_id: '',
    purchase_order_id: '', invoice_number: '', delivery_note_number: '',
    verified_by: '', notes: ''
  });
  const [lineItems, setLineItems] = useState<Array<{
    item_id: string; batch_number: string; expiry_date: string;
    qty_ordered: string; qty_delivered: string; qty_accepted: string;
    scale_weight: string;
    unit: string; unit_price: string; condition_status: string;
    temperature_value: string; notes: string;
  }>>([{ item_id: '', batch_number: '', expiry_date: '', qty_ordered: '', qty_delivered: '', qty_accepted: '', scale_weight: '', unit: 'kg', unit_price: '', condition_status: 'GOOD', temperature_value: '', notes: '' }]);
  const [list, setList] = useState(headers);
  const [err, setErr] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, Record<string, string>[]>>({});
  const [detailBusy, setDetailBusy] = useState<string | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  async function loadDetail(id: string) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    setDetailErr(null);
    if (detail[id]) return;
    setDetailBusy(id);
    try {
      const r = await fetch(`/api/warehouse/receiving?id=${encodeURIComponent(id)}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) { setDetailErr(j.error?.message ?? 'Gagal memuat detail'); return; }
      setDetail({ ...detail, [id]: j.data?.items ?? [] });
    } catch {
      setDetailErr('Koneksi gagal');
    } finally {
      setDetailBusy(null);
    }
  }

  async function create() {
    setErr(null);
    // Fraud gate (owner directive): photo proof of weight/receiving is mandatory.
    if (evidence.length === 0) { setErr('Foto bukti timbang/penerimaan wajib diunggah sebelum submit'); return; }
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
        scale_weight: it.scale_weight.trim() !== '' ? Number(it.scale_weight) : undefined,
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
    if (k === 'item_id') copy[idx].unit = items.find(item => item.item_id === v)?.base_unit || '';
    setLineItems(copy);
  };
  const addLine = () => setLineItems([...lineItems, { item_id: '', batch_number: '', expiry_date: '', qty_ordered: '', qty_delivered: '', qty_accepted: '', scale_weight: '', unit: 'kg', unit_price: '', condition_status: 'GOOD', temperature_value: '', notes: '' }]);

  return (
    <div className='space-y-3'>
      {canCreate && (
        <button onClick={() => setShowForm(!showForm)} className='rounded bg-[#E01020] px-3 py-1.5 text-xs font-medium text-primary-foreground'>
          {showForm ? 'Tutup' : '+ Receiving Baru'}
        </button>
      )}
      {canCreate && showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
            <select value={form.source_type} onChange={(e) => update('source_type', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              <option value='SUPPLIER'>Supplier</option><option value='CENTRAL_WAREHOUSE'>Gudang Pusat</option>
              <option value='OTHER_OUTLET'>Outlet Lain</option><option value='RETURN'>Return</option>
            </select>
            <SearchableSelect searchLabel='supplier' value={form.supplier_id} onChange={(e) => update('supplier_id', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Supplier</option>
              {suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
            </SearchableSelect>
            <SearchableSelect searchLabel='lokasi tujuan' value={form.destination_location_id} onChange={(e) => update('destination_location_id', e.target.value)} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Lokasi Tujuan</option>
              {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
            </SearchableSelect>
            <input placeholder='PO Number' value={form.purchase_order_id} onChange={(e) => update('purchase_order_id', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Invoice #' value={form.invoice_number} onChange={(e) => update('invoice_number', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Delivery Note #' value={form.delivery_note_number} onChange={(e) => update('delivery_note_number', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Diterima Oleh (otomatis: user login)' value='Penerima = user login' readOnly disabled className='rounded border border-border bg-muted px-2 py-1 text-xs text-muted-foreground' />
            <input placeholder='Verified By (wajib beda orang saat ada selisih)' value={form.verified_by} onChange={(e) => update('verified_by', e.target.value)} className='rounded border border-border px-2 py-1 text-xs' />
          </div>
          <p className='text-xs font-medium'>Line Items</p>
          <datalist id='receiving-unit-options'>
            {['kg','g','ml','l','pc','pax','pack','ikat','slice'].map((u) => <option key={u} value={u} />)}
          </datalist>
          {lineItems.map((it, idx) => (
            <div key={idx} className='grid grid-cols-2 gap-1 md:grid-cols-6 border-t border-border pt-1'>
              <SearchableSelect searchLabel={`item baris ${idx + 1}`} value={it.item_id} onChange={(e) => updateLine(idx, 'item_id', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]'>
                <option value=''>Item</option>
                {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.item_name}{i.item_code ? ` · ${i.item_code}` : ''}{i.base_unit ? ` · ${i.base_unit}` : ''}</option>)}
              </SearchableSelect>
              <input placeholder='Batch' value={it.batch_number} onChange={(e) => updateLine(idx, 'batch_number', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Expiry' type='date' value={it.expiry_date} onChange={(e) => updateLine(idx, 'expiry_date', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Qty Order' value={it.qty_ordered} onChange={(e) => updateLine(idx, 'qty_ordered', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Qty Delivered' value={it.qty_delivered} onChange={(e) => updateLine(idx, 'qty_delivered', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Qty Accepted' value={it.qty_accepted} onChange={(e) => updateLine(idx, 'qty_accepted', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder={`Timbangan (${it.unit || 'satuan baris'})`} type='number' step='any' min='0' value={it.scale_weight} onChange={(e) => updateLine(idx, 'scale_weight', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Unit' list='receiving-unit-options' value={it.unit} onChange={(e) => updateLine(idx, 'unit', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
              <input placeholder='Harga per satuan baris (boleh desimal)' type='number' step='any' min='0' value={it.unit_price} onChange={(e) => updateLine(idx, 'unit_price', e.target.value)} className='rounded border border-border px-1 py-0.5 text-[10px]' />
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
          <button onClick={create} className='rounded bg-[#E01020] px-3 py-1 text-xs font-medium text-primary-foreground'>Simpan Receiving</button>
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
              <th className='px-2 py-1 text-left'>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {list.map((h) => (
              <Fragment key={h.receiving_id}>
              <tr className='border-t border-border'>
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
                <td className='px-2 py-1'>
                  <button onClick={() => loadDetail(h.receiving_id)} className='rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted'>
                    {openId === h.receiving_id ? 'Tutup' : detailBusy === h.receiving_id ? 'Memuat…' : 'Detail'}
                  </button>
                </td>
              </tr>
              {openId === h.receiving_id && (
                <tr className='border-t border-border bg-muted/30'>
                  <td colSpan={9} className='px-2 py-2'>
                    {detailErr && <p className='text-xs text-destructive'>{detailErr}</p>}
                    {!detailErr && !detail[h.receiving_id] && <p className='text-xs text-muted-foreground'>Memuat baris…</p>}
                    {detail[h.receiving_id]?.length === 0 && <p className='text-xs text-muted-foreground'>Tidak ada baris tersimpan untuk faktur ini.</p>}
                    {!!detail[h.receiving_id]?.length && (
                      <table className='w-full text-[10px]'>
                        <thead className='text-muted-foreground'>
                          <tr>
                            <th className='px-1 py-0.5 text-left'>Item</th>
                            <th className='px-1 py-0.5 text-right'>Qty Diterima</th>
                            <th className='px-1 py-0.5 text-left'>Unit</th>
                            <th className='px-1 py-0.5 text-right'>Harga/Unit</th>
                            <th className='px-1 py-0.5 text-right'>Total</th>
                            <th className='px-1 py-0.5 text-left'>Kondisi</th>
                            <th className='px-1 py-0.5 text-left'>Batch</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail[h.receiving_id].map((it) => (
                            <tr key={it.receiving_item_id} className='border-t border-border/50'>
                              <td className='px-1 py-0.5'>{items.find((i) => i.item_id === it.item_id)?.item_name ?? it.item_id}</td>
                              <td className='px-1 py-0.5 text-right'>{it.qty_accepted}</td>
                              <td className='px-1 py-0.5'>{it.unit}</td>
                              <td className='px-1 py-0.5 text-right'>{it.unit_price}</td>
                              <td className='px-1 py-0.5 text-right'>{it.total_value}</td>
                              <td className='px-1 py-0.5'>{it.condition_status}</td>
                              <td className='px-1 py-0.5'>{it.batch_number || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
