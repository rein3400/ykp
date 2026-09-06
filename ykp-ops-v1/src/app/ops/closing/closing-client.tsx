'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatIdr } from '@/lib/format';

export function ClosingClient({
  rows,
  outlets,
}: {
  rows: Record<string, string>[];
  outlets: Record<string, string>[];
}) {
  const router = useRouter();
  const [outletId, setOutletId] = useState(outlets[0]?.outlet_id ?? '');
  const [expected, setExpected] = useState('0');
  const [actual, setActual] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const diff = Number(actual) - Number(expected);

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ops/closing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          expected_cash: expected,
          actual_cash: actual,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j?.error?.message ?? 'Gagal'); return; }
      router.refresh();
    } finally { setLoading(false); }
  }

  return (
    <div className='space-y-4'>
      <div className='rounded-xl border bg-white p-4 space-y-3'>
        <h2 className='font-semibold'>Input Closing</h2>
        {error && <div className='text-sm text-red-600'>{error}</div>}
        <div className='grid gap-3 sm:grid-cols-2'>
          <select aria-label='Pilih outlet' className='rounded border px-3 py-2 text-sm' value={outletId} onChange={(e) => setOutletId(e.target.value)}>
            {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
          </select>
          <div className='text-sm text-slate-600 self-center'>Δ kas: <b>{formatIdr(diff)}</b></div>
          <input type='number' className='rounded border px-3 py-2 text-sm' placeholder='Expected cash' value={expected} onChange={(e) => setExpected(e.target.value)} />
          <input type='number' className='rounded border px-3 py-2 text-sm' placeholder='Actual cash' value={actual} onChange={(e) => setActual(e.target.value)} />
        </div>
        <button onClick={submit} disabled={loading} className='rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50'>
          {loading ? 'Simpan…' : 'Submit Closing'}
        </button>
      </div>
      <div className='rounded-xl border bg-white p-4'>
        <h2 className='mb-3 font-semibold'>Riwayat Closing</h2>
        {rows.length === 0 ? (
          <p className='text-sm text-slate-500'>Belum ada closing.</p>
        ) : (
          <ul className='space-y-2'>
            {rows.slice().reverse().map((r) => (
              <li key={r.closing_id} className='rounded border p-3 text-sm'>
                <span className='font-medium'>{r.outlet_id}</span>
                <span className='ml-2 text-xs'>{formatIdr(r.cash_difference)}</span>
                <span className='ml-2 text-xs text-slate-500'>{r.status}</span>
                <div className='mt-1 text-xs text-slate-500'>{r.date} · closed by {r.closed_by}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
