'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ChangePasswordForm() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!current || !next) {
      setErr('Semua kolom wajib diisi.');
      return;
    }
    if (next.length < 6) {
      setErr('Password baru minimal 6 karakter.');
      return;
    }
    if (next !== confirm) {
      setErr('Konfirmasi password tidak cocok.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current_password: current, new_password: next })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.error?.message ?? 'Gagal mengubah password');
      }
      router.push('/hr');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal mengubah password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className='space-y-4'>
      <div>
        <label htmlFor='cp-current' className='block text-sm font-medium text-slate-700'>
          Password Lama
        </label>
        <input
          id='cp-current'
          name='current_password'
          type={showPw ? 'text' : 'password'}
          autoComplete='current-password'
          autoFocus
          className='mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor='cp-new' className='block text-sm font-medium text-slate-700'>
          Password Baru
        </label>
        <input
          id='cp-new'
          name='new_password'
          type={showPw ? 'text' : 'password'}
          autoComplete='new-password'
          className='mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor='cp-confirm' className='block text-sm font-medium text-slate-700'>
          Konfirmasi Password Baru
        </label>
        <input
          id='cp-confirm'
          name='confirm_password'
          type={showPw ? 'text' : 'password'}
          autoComplete='new-password'
          className='mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>

      <label className='flex items-center gap-2 text-xs text-slate-600'>
        <input
          type='checkbox'
          checked={showPw}
          onChange={(e) => setShowPw(e.target.checked)}
          className='h-3.5 w-3.5 rounded border-slate-300'
        />
        Tampilkan password
      </label>

      {err && (
        <div role='alert' className='rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700'>
          {err}
        </div>
      )}

      <button
        type='submit'
        disabled={busy}
        className='w-full rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'
      >
        {busy ? 'Menyimpan…' : 'Simpan Password Baru'}
      </button>
    </form>
  );
}
