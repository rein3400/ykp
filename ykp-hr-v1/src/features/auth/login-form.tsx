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
  const [u, setU] = useState('owner');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? 'Login gagal');
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
    <form onSubmit={submit} className="space-y-3" method="post" action="/api/auth/login">
      <label className="block text-sm" htmlFor="hr-login-username">
        Username
        <input
          id="hr-login-username"
          name="username"
          className="input mt-1 w-full"
          value={u}
          onChange={(e) => setU(e.target.value)}
          required
          autoComplete="username"
        />
      </label>
      <label className="block text-sm" htmlFor="hr-login-password">
        Password
        <input
          id="hr-login-password"
          name="password"
          className="input mt-1 w-full"
          type="password"
          value={p}
          onChange={(e) => setP(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>
      {err ? <div className="text-sm text-red-600" role="alert">{err}</div> : null}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? '...' : 'Login'}
      </button>
      <p className="text-xs text-muted-foreground">
        Default testing: owner / owner123 (seed first via <code>npm run sheets:bootstrap</code> +{' '}
        <code>sheets:seed-user</code>).
      </p>
    </form>
  );
}