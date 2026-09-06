'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error?.message ?? 'Login gagal');
        return;
      }
      const redirect = searchParams.get('redirect');
      const dest =
        redirect && redirect.startsWith('/') && !redirect.startsWith('//')
          ? redirect
          : '/ops';
      router.push(dest);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
      <div>
        <h1 className="text-xl font-bold">YKP Operational V1</h1>
        <p className="text-sm text-slate-500">Login outlet operations</p>
      </div>
      {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div>
        <label htmlFor='login-u' className="mb-1 block text-xs font-medium text-slate-600">Username</label>
        <input id='login-u'
          name="username"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
      </div>
      <div>
        <label htmlFor='login-p' className="mb-1 block text-xs font-medium text-slate-600">Password</label>
        <input id='login-p'
          name="password"
          type="password"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? 'Masuk…' : 'Masuk'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
