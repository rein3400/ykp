'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('owner123');
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
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error?.message ?? 'Login gagal');
        return;
      }
      router.push('/ops');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-slate-100'>
      <form onSubmit={onSubmit} className='w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow'>
        <div>
          <h1 className='text-xl font-bold'>YKP Operational V1</h1>
          <p className='text-sm text-slate-500'>Login outlet operations</p>
        </div>
        {error && <div className='rounded bg-red-50 px-3 py-2 text-sm text-red-700'>{error}</div>}
        <div>
          <label className='mb-1 block text-xs font-medium text-slate-600'>Username</label>
          <input
            name="username"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Password</label>
          <input
            name="password"
            type="password"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <button
          type='submit'
          disabled={loading}
          className='w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50'
        >
          {loading ? 'Masuk…' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
