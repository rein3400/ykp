'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Owner-only: regenerate the investor daily summary for today.
 * The component is referenced by /investor page but was never committed
 * (broken import on origin/main) — created 2026-07-19 to close the gap.
 */
export function RegenerateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function regenerate() {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/investor/summary/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      }
      setMsg('Summary di-regenerate.');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className='inline-flex items-center gap-2'>
      <button
        type='button'
        onClick={regenerate}
        disabled={busy}
        className='rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50'
      >
        {busy ? 'Regenerating…' : 'Regenerate Summary'}
      </button>
      {msg && <span className='text-xs text-slate-500'>{msg}</span>}
    </span>
  );
}
