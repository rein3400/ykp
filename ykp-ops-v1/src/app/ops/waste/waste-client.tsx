'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatIdr } from '@/lib/format';

export function WasteClient({
  rows,
  outlets,
}: {
  rows: Record<string, string>[];
  outlets: Record<string, string>[];
}) {
  const router = useRouter();
  const [outletId, setOutletId] = useState(outlets[0]?.outlet_id ?? '');
  const [ingredient, setIngredient] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('0');
  const [type, setType] = useState('SPOILED');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const total = Number(qty) * Number(unitCost);

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ops/waste', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          ingredient_name: ingredient,
          qty,
          unit,
          estimated_unit_cost: unitCost,
          waste_type: type,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j?.error?.message ?? 'Gagal'); return; }
      setIngredient('');
      router.refresh();
    } finally { setLoading(false); }
  }

  const unit = 'kg';

  return (
    <div className='space-y-4'>
      <div className='rounded-xl border bg-white p-4 space-y-3'>
        <h2 className='font-semibold'>Input Waste</h2>
        {error && <div className='text-sm text-red-600'>{error}</div>}
        <div className='grid gap-3 sm:grid-cols-2'>
          <select className='rounded border px-3 py-2 text-sm' value={outletId} onChange={(e) => setOutletId(e.target.value)}>
            {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
          </select>
          <select className='rounded border px-3 py-2 text-sm' value={type} onChange={(e) => setType(e.target.value)}>
            {['SPOILED', 'OVERPRODUCTION', 'WRONG_ORDER', 'QC_REJECT', 'PORTION_ERROR', 'STORAGE_ERROR', 'EXPIRED', 'OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className='rounded border px-3 py-2 text-sm' placeholder='Ingredient name' value={ingredient} onChange={(e) => setIngredient(e.target.value)} />
          <input type='number' className='rounded border px-3 py-2 text-sm' placeholder='Qty' value={qty} onChange={(e) => setQty(e.target.value)} />
          <input type='number' className='rounded border px-3 py-2 text-sm' placeholder='Unit cost' value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          <div className='self-center text-sm text-slate-600'>Est: <b>{formatIdr(total)}</b></div>
        </div>
        <button onClick={submit} disabled={loading || !ingredient.trim()} className='rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50'>
          {loading ? 'Simpan…' : 'Submit Waste'}
        </button>
      </div>
      <div className='rounded-xl border bg-white p-4'>
        <h2 className='mb-3 font-semibold'>Daftar Waste</h2>
        {rows.length === 0 ? (
          <p className='text-sm text-slate-500'>Belum ada waste.</p>
        ) : (
          <ul className='space-y-2'>
            {rows.slice().reverse().map((r) => (
              <li key={r.waste_id} className='rounded border p-3 text-sm'>
                <span className='font-medium'>{r.ingredient_name}</span>
                <span className='ml-2 text-xs text-slate-500'>{r.waste_type}</span>
                <span className='ml-2 text-xs'>{formatIdr(r.estimated_total_value)}</span>
                <div className='mt-1 text-xs text-slate-500'>{r.date} · {r.outlet_id}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
