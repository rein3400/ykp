'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('owner123');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? 'Login gagal'); }
      else { router.push('/investor'); }
    } catch { setErr('Network error'); }
    finally { setLoading(false); }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-muted'>
      <div className='w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-sm'>
        <h1 className='mb-1 text-xl font-bold'>YKP Investor V1</h1>
        <p className='mb-4 text-xs text-muted-foreground'>Dashboard investor + cap table — owner / investor</p>
        <form onSubmit={onSubmit} className='space-y-3'>
          <div>
            <label className='mb-1 block text-xs font-medium'>Username</label>
            <input type='text' value={username} onChange={(e) => setUsername(e.target.value)}
              className='w-full rounded border border-border px-3 py-2 text-sm' required autoFocus />
          </div>
          <div>
            <label className='mb-1 block text-xs font-medium'>Password</label>
            <input type='password' value={password} onChange={(e) => setPassword(e.target.value)}
              className='w-full rounded border border-border px-3 py-2 text-sm' required />
          </div>
          {err && <p className='text-xs text-destructive'>{err}</p>}
          <button type='submit' disabled={loading}
            className='w-full rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50'>
            {loading ? 'Memproses…' : 'Login'}
          </button>
        </form>
        <p className='mt-4 text-[10px] text-muted-foreground'>Default: owner / owner123 — GANTI sebelum pilot.</p>
      </div>
    </div>
  );
}