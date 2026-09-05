'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ImportEmployees() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/hr/employees/import', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? 'Gagal');
      setMsg(`Imported ${j.data?.imported ?? 0} rows`);
      router.push('/hr/employees');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className='space-y-3'>
      <label className='block text-sm font-medium text-slate-700'>File CSV karyawan<input type='file' name='file' accept='.csv,text/csv' className='input mt-1 w-full' required /></label>
      {error && <div className='text-sm text-red-600'>{error}</div>}
      {msg && <div className='text-sm text-green-700'>{msg}</div>}
      <button type='submit' disabled={busy} className='btn-primary'>{busy ? '...' : 'Upload & Import'}</button>
    </form>
  );
}