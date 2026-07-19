'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function QcClient({
  rows: serverRows,
  products,
  outlets,
}: {
  rows: Record<string, string>[];
  products: Record<string, string>[];
  outlets: Record<string, string>[];
}) {
  const router = useRouter();
  // Serverless mock store isn't shared between the page function and the API
  // route function — fetch the list from the API (same instance as POST).
  const [rows, setRows] = useState(serverRows);
  const refetch = () => {
    fetch('/api/ops/qc', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        const items = Array.isArray(j?.data) ? j.data : (j?.data?.items ?? j?.data?.qc ?? []);
        if (Array.isArray(items) && items.length) setRows(items);
      })
      .catch(() => {});
  };
  useEffect(refetch, []);
  const [outletId, setOutletId] = useState(outlets[0]?.outlet_id ?? '');
  const [productId, setProductId] = useState(products[0]?.product_id ?? '');
  const [score, setScore] = useState('4');
  const [category, setCategory] = useState('APPEARANCE');
  const [photo, setPhoto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError('Ukuran foto maksimal 4MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ops/qc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          product_id: productId,
          score,
          max_score: '5',
          qc_category: category,
          photo_url: photo,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j?.error?.message ?? `Gagal menyimpan (HTTP ${res.status})`); return; }
      setPhoto('');
      refetch();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghubungi server');
    } finally { setLoading(false); }
  }

  return (
    <div className='space-y-4'>
      <div className='rounded-xl border bg-white p-4 space-y-3'>
        <h2 className='font-semibold'>Input QC</h2>
        <p className='text-xs text-slate-500'>AI vision = second opinion only. Final decision tetap reviewer.</p>
        {error && <div className='text-sm text-red-600'>{error}</div>}
        <div className='grid gap-3 sm:grid-cols-2'>
          <select className='rounded border px-3 py-2 text-sm' value={outletId} onChange={(e) => setOutletId(e.target.value)}>
            {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
          </select>
          <select className='rounded border px-3 py-2 text-sm' value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
          </select>
          <select className='rounded border px-3 py-2 text-sm' value={category} onChange={(e) => setCategory(e.target.value)}>
            {['APPEARANCE', 'COLOR', 'PORTION', 'TEMPERATURE', 'TEXTURE', 'PACKAGING', 'CLEANLINESS'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type='number'
            min={0}
            max={5}
            step={0.5}
            className='rounded border px-3 py-2 text-sm'
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </div>
        <div className='space-y-2'>
          <label className='block text-sm font-medium text-slate-700'>Foto produk</label>
          <input type='file' accept='image/*' onChange={handlePhoto} className='text-sm' />
          {photo && <img src={photo} alt='preview' className='h-32 w-32 rounded border object-cover' />}
        </div>
        <button onClick={submit} disabled={loading} className='rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50'>
          {loading ? 'Simpan…' : 'Simpan QC'}
        </button>
      </div>
      <div className='rounded-xl border bg-white p-4'>
        <h2 className='mb-3 font-semibold'>Riwayat QC</h2>
        {rows.length === 0 ? (
          <p className='text-sm text-slate-500'>Belum ada QC.</p>
        ) : (
          <ul className='space-y-2'>
            {rows.slice().reverse().map((r) => (
              <li key={r.qc_id} className='rounded border p-3 text-sm'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='font-medium'>{r.product_name}</span>
                  <span className='ml-2 text-xs text-slate-500'>{r.qc_category}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${r.status === 'PASS' ? 'bg-green-100 text-green-700' : r.status === 'FAIL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {r.status} · {r.score}/{r.max_score}
                  </span>
                </div>
                {r.ai_result && (
                  <div className='mt-2 rounded bg-indigo-50 p-2 text-xs text-indigo-900'>
                    <span className='font-semibold'>AI second opinion:</span> {r.ai_result} (confidence {Math.round(Number(r.ai_confidence) * 100)}%) · {r.second_opinion_status}
                    {r.defect_type && <span className='block text-slate-600'>Defects: {r.defect_type}</span>}
                  </div>
                )}
                <div className='mt-1 text-xs text-slate-400'>{r.date} · {r.outlet_id}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
