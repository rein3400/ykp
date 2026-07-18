'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function BriefingClient({
  rows,
  shifts,
  outlets,
}: {
  rows: Record<string, string>[];
  shifts: Record<string, string>[];
  outlets: Record<string, string>[];
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [outletId, setOutletId] = useState(outlets[0]?.outlet_id ?? '');
  const [shiftId, setShiftId] = useState(shifts[0]?.shift_id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ops/briefing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, shift_id: shiftId, briefing_text: text, briefing_type: 'MANUAL' }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error?.message ?? 'Gagal simpan');
        return;
      }
      setText('');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='space-y-4'>
      <div className='rounded-xl border bg-white p-4 space-y-3'>
        <h2 className='font-semibold'>Tambah Briefing</h2>
        {error && <div className='text-sm text-red-600'>{error}</div>}
        <div className='grid gap-3 sm:grid-cols-2'>
          <select className='rounded border px-3 py-2 text-sm' value={outletId} onChange={(e) => setOutletId(e.target.value)}>
            {outlets.map((o) => (
              <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>
            ))}
          </select>
          <select className='rounded border px-3 py-2 text-sm' value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            {shifts.map((s) => (
              <option key={s.shift_id} value={s.shift_id}>{s.shift_name}</option>
            ))}
          </select>
        </div>
        <textarea
          className='w-full rounded border px-3 py-2 text-sm'
          rows={3}
          placeholder='Fokus shift, priority menu, staffing warning…'
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={submit}
          disabled={loading || !text.trim()}
          className='rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50'
        >
          {loading ? 'Simpan…' : 'Publish Briefing'}
        </button>
      </div>

      <div className='rounded-xl border bg-white p-4'>
        <h2 className='mb-3 font-semibold'>Daftar Briefing</h2>
        {rows.length === 0 ? (
          <p className='text-sm text-slate-500'>Belum ada briefing.</p>
        ) : (
          <ul className='space-y-3'>
            {rows.slice().reverse().map((r) => (
              <li key={r.briefing_id} className='rounded border p-3 text-sm'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='font-medium'>{r.outlet_name || r.outlet_id} · {r.shift_name || r.shift_id}</span>
                  <span className='font-mono text-xs text-slate-500'>{r.date}</span>
                </div>
                <p className='mt-1 text-slate-700'>{r.briefing_text}</p>
                <div className='mt-1 text-xs text-slate-400'>{r.briefing_type} · {r.published_status}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
