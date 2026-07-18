'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OpeningClient({
  templates,
  outlets,
  shifts,
  rows,
}: {
  templates: Record<string, string>[];
  outlets: Record<string, string>[];
  shifts: Record<string, string>[];
  rows: Record<string, string>[];
}) {
  const router = useRouter();
  const [outletId, setOutletId] = useState(outlets[0]?.outlet_id ?? '');
  const [shiftId, setShiftId] = useState(shifts[0]?.shift_id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const selectedTemplates = templates.filter((t) => t.checklist_type === 'OPENING');

  async function submitAll() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ops/opening', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          shift_id: shiftId,
          items: selectedTemplates.map((t) => ({
            checklist_item: t.checklist_item,
            critical_flag: t.critical_flag,
            status: 'DONE',
          })),
        }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j?.error?.message ?? 'Gagal'); return; }
      router.refresh();
    } finally { setLoading(false); }
  }

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 sm:grid-cols-2'>
        <select className='rounded border px-3 py-2 text-sm' value={outletId} onChange={(e) => setOutletId(e.target.value)}>
          {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
        </select>
        <select className='rounded border px-3 py-2 text-sm' value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
          {shifts.map((s) => <option key={s.shift_id} value={s.shift_id}>{s.shift_name}</option>)}
        </select>
      </div>
      {error && <div className='text-sm text-red-600'>{error}</div>}
      <button
        onClick={submitAll}
        disabled={loading}
        className='rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50'
      >
        {loading ? 'Simpan…' : 'Submit Opening Checklist'}
      </button>

      <div className='rounded-xl border bg-white p-4'>
        <h2 className='mb-3 font-semibold'>Riwayat Opening</h2>
        {rows.length === 0 ? (
          <p className='text-sm text-slate-500'>Belum ada opening checklist.</p>
        ) : (
          <ul className='space-y-2'>
            {rows.slice().reverse().map((r) => (
              <li key={r.opening_id} className='rounded border p-3 text-sm'>
                <span className='font-medium'>{r.checklist_item}</span>
                <span className={`ml-2 rounded px-2 py-0.5 text-xs ${r.status === 'DONE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                <div className='mt-1 text-xs text-slate-400'>{r.outlet_id} · {r.date} · {r.completed_by}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
