'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Login form. Submit prefers FormData DOM values so browser automation
 * (WebBridge fill / native value set) still works even when React state
 * lags behind the controlled inputs.
 */
export function LoginForm() {
  const router = useRouter();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!u.trim() || !p) {
      setErr('Username dan password wajib diisi.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const fd = new FormData(e.currentTarget);
      const username = String(fd.get('username') ?? u).trim();
      const password = String(fd.get('password') ?? p);
      if (!username || !password) {
        throw new Error('Username dan password wajib diisi');
      }

      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? 'Username atau password salah');
      }
      router.push('/hr');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Login gagal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className='space-y-4' method='post' action='/api/auth/login' noValidate={false}>
      <div>
        <label htmlFor='login-username' className='block text-sm font-medium text-slate-700'>
          Username
        </label>
        <input
          id='login-username'
          name='username'
          autoComplete='username'
          autoFocus
          className='mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'
          value={u}
          onChange={(e) => setU(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor='login-password' className='block text-sm font-medium text-slate-700'>
          Password
        </label>
        <div className='relative mt-1'>
          <input
            id='login-password'
            name='password'
            autoComplete='current-password'
            type={showPw ? 'text' : 'password'}
            className='block w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-10 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'
            value={p}
            onChange={(e) => setP(e.target.value)}
            required
          />
          <button
            type='button'
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
            className='absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600'
          >
            {showPw ? (
              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='h-4 w-4'>
                <path strokeLinecap='round' strokeLinejoin='round' d='M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88' />
              </svg>
            ) : (
              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='h-4 w-4'>
                <path strokeLinecap='round' strokeLinejoin='round' d='M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z' />
                <path strokeLinecap='round' strokeLinejoin='round' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
              </svg>
            )}
          </button>
        </div>
      </div>

      {err && (
        <div role='alert' className='rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700'>
          {err}
        </div>
      )}

      <button
        type='submit'
        disabled={busy}
        className='w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'
      >
        {busy ? (
          <span className='inline-flex items-center gap-2'>
            <svg className='h-4 w-4 animate-spin' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
              <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
              <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
            </svg>
            Masuk…
          </span>
        ) : (
          'Masuk'
        )}
      </button>
    </form>
  );
}
