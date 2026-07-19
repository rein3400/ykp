'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PhotoUpload from '@/components/photo-upload';

type Row = Record<string, string>;

const inputCls = 'w-full rounded border border-border px-2 py-1.5 text-xs';
const labelCls = 'mb-1 block text-[10px] font-medium uppercase text-muted-foreground';

function formatIdr(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v || '-';
  return `Rp${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export default function ReceiptsClient({
  receipts, outlets, today
}: {
  receipts: Row[]; outlets: Row[]; today: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoId, setPhotoId] = useState('');
  const [form, setForm] = useState({
    date: today, outlet_id: outlets[0]?.outlet_id ?? '', amount: '', description: ''
  });

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  async function submit() {
    setErr(null);
    if (!photoId) { setErr('Foto struk wajib diunggah'); return; }
    if (!form.outlet_id) { setErr('Pilih outlet'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/ops/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          outlet_id: form.outlet_id,
          amount: Number(form.amount || 0),
          description: form.description,
          photo_attachment_id: photoId
        })
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? 'Gagal menyimpan'); return; }
      setShowForm(false);
      setPhotoId('');
      setForm({ date: today, outlet_id: outlets[0]?.outlet_id ?? '', amount: '', description: '' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='space-y-3'>
      <button
        onClick={() => setShowForm(!showForm)}
        className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'
      >
        {showForm ? 'Tutup' : '+ Upload Struk'}
      </button>

      {showForm && (
        <div className='max-w-md space-y-2 rounded border border-border bg-background p-3'>
          <div className='grid grid-cols-2 gap-2'>
            <label className='block'>
              <span className={labelCls}>Tanggal</span>
              <input type='date' value={form.date} onChange={(e) => update('date', e.target.value)} className={inputCls} />
            </label>
            <label className='block'>
              <span className={labelCls}>Outlet</span>
              <select value={form.outlet_id} onChange={(e) => update('outlet_id', e.target.value)} className={inputCls}>
                {outlets.map((o) => (
                  <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>
                ))}
              </select>
            </label>
            <label className='block'>
              <span className={labelCls}>Jumlah (Rp)</span>
              <input type='number' min='0' placeholder='0' value={form.amount} onChange={(e) => update('amount', e.target.value)} className={inputCls} />
            </label>
            <label className='block'>
              <span className={labelCls}>Keterangan</span>
              <input placeholder='Beli apa?' value={form.description} onChange={(e) => update('description', e.target.value)} className={inputCls} />
            </label>
          </div>
          <PhotoUpload entityType='receipt' onUploaded={setPhotoId} label='Foto struk' />
          {err && <p className='text-xs text-destructive'>{err}</p>}
          <button
            onClick={submit}
            disabled={busy || !photoId}
            className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50'
          >
            {busy ? 'MenyimpanΓÇª' : 'Simpan Struk'}
          </button>
        </div>
      )}

      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-left text-xs'>
          <thead>
            <tr className='border-b border-border bg-muted text-[10px] uppercase text-muted-foreground'>
              <th className='px-2 py-1.5 font-medium'>Tanggal</th>
              <th className='px-2 py-1.5 font-medium'>Outlet</th>
              <th className='px-2 py-1.5 font-medium'>Jumlah</th>
              <th className='px-2 py-1.5 font-medium'>Keterangan</th>
              <th className='px-2 py-1.5 font-medium'>Oleh</th>
              <th className='px-2 py-1.5 font-medium'>Foto</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 && (
              <tr>
                <td colSpan={6} className='px-2 py-6 text-center text-muted-foreground'>
                  Belum ada struk terupload.
                </td>
              </tr>
            )}
            {receipts.map((r) => (
              <tr key={r.receipt_id} className='border-b border-border/50 align-top'>
                <td className='px-2 py-1.5 whitespace-nowrap'>{r.date}</td>
                <td className='px-2 py-1.5'>{r.outlet_name}</td>
                <td className='px-2 py-1.5 whitespace-nowrap'>{formatIdr(r.amount)}</td>
                <td className='px-2 py-1.5'>{r.description}</td>
                <td className='px-2 py-1.5'>{r.submitted_by}</td>
                <td className='px-2 py-1.5'>
                  {r.photo_url && (
                    <a href={r.photo_url} target='_blank' rel='noreferrer' className='text-primary underline'>
                      Lihat
                    </a>
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
