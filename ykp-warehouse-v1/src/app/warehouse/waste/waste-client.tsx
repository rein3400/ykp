'use client';
import { useState } from 'react';
import { EvidenceUpload, type EvidenceFile } from '@/components/evidence-upload';
import { EvidenceGallery } from '@/components/evidence-gallery';

export default function WasteClient({
  rows, items, outlets
}: {
  rows: Record<string, string>[];
  items: Record<string, string>[];
  outlets: Record<string, string>[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ outlet_id: '', item_id: '', qty: '', unit: 'kg', reason: '', photo_url: '', pic: '', witness_signature: '' });
  const [list, setList] = useState(rows);
  const [err, setErr] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  // waste rows store only item_id (no item_name column) — resolve the display
  // name from the items master so the Item column isn't blank / a raw id.
  const itemNameById = new Map(items.map((i) => [i.item_id, i.item_name]));
  const selectedItem = items.find((i) => i.item_id === form.item_id);

  async function create() {
    setErr(null);
    const body = {
      ...form,
      photo_url: form.photo_url || evidence[0]?.url || '',
      evidence_urls: evidence,
      item_name: selectedItem?.item_name ?? '',
      unit: form.unit || selectedItem?.unit || 'kg',
      buy_price: selectedItem?.buy_price ?? '0'
    };
    const r = await fetch('/api/warehouse/waste', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    const row = j.data?.waste_id ? j.data : (j.data ?? {});
    setList([row, ...list]);
    setEvidence([]);
    setShowForm(false);
  }

  return (
    <div className='space-y-3'>
      <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
        {showForm ? 'Tutup' : '+ Catat Waste'}
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
            <input placeholder='Qty' value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Satuan' value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='Alasan' value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='PIC' value={form.pic} onChange={(e) => setForm({ ...form, pic: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input placeholder='TTD Saksi' value={form.witness_signature} onChange={(e) => setForm({ ...form, witness_signature: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            </div>
          <EvidenceUpload
            transactionType="waste"
            value={evidence}
            onChange={(files) => {
              setEvidence(files);
              if (files[0]?.url) setForm((f) => ({ ...f, photo_url: files[0].url }));
            }}
            label="Bukti Foto Waste (wajib)"
          />
          {err && <p className='text-xs text-destructive'>{err}</p>}
          <button onClick={create} className='rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'>Simpan</button>
        </div>
      )}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Tanggal</th><th className='px-2 py-1 text-left'>Item</th>
              <th className='px-2 py-1 text-right'>Qty</th><th className='px-2 py-1 text-left'>Alasan</th>
              <th className='px-2 py-1 text-center'>Foto</th><th className='px-2 py-1 text-right'>Est. Loss</th>
              <th className='px-2 py-1 text-left'>PIC</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.waste_id} className={`border-t border-border ${!r.photo_url ? 'bg-destructive/5' : ''}`}>
                <td className='px-2 py-1'>{r.date}</td>
                <td className='px-2 py-1'>{r.item_name || itemNameById.get(r.item_id) || r.item_id}</td>
                <td className='px-2 py-1 text-right'>{r.qty} {r.unit}</td>
                <td className='px-2 py-1'>{r.reason}</td>
                <td className='px-2 py-1 text-center'>
                  {r.photo_url ? (
                    <EvidenceGallery files={[{ url: r.photo_url, path: r.photo_url, media_type: 'image' }]} />
                  ) : '✗'}
                </td>
                <td className='px-2 py-1 text-right'>{formatRp(r.estimated_total_value || r.estimated_loss)}</td>
                <td className='px-2 py-1'>{r.reported_by || r.pic}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className='px-2 py-3 text-center text-muted-foreground'>Belum ada waste.</td></tr>}
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