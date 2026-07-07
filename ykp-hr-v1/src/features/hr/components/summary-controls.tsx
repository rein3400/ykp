'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SummaryControls() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function regen() {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/hr/summary/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? 'Gagal');
      setMsg(`Generated ${j.data?.count ?? 0} summary rows for ${date}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='card flex flex-wrap items-end gap-3'>
      <label className='text-sm'>
        Tanggal
        <input type='date' className='input mt-1' value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button onClick={regen} disabled={busy} className='btn-primary'>{busy ? '...' : 'Regenerate'}</button>
      {msg && <div className='text-sm text-muted-foreground'>{msg}</div>}
    </div>
  );
}