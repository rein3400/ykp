"use client";
import { useState } from "react";
import { HubLogo, UserIcon, LockIcon } from "./icons";

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
}

export function LoginForm({ onLogin }: Props) {
  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onLogin(username, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white animate-fade-in">
      {/* Background mesh + grid pattern */}
      <div className="absolute inset-0 gradient-mesh opacity-90" />
      <div className="absolute inset-0 grid-pattern" />
      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(0,0,0,0.6)_100%)]" />

      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-2xl shadow-blue-500/40 ring-1 ring-white/10">
              <HubLogo className="h-8 w-8" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">YKP ERP</h1>
            <p className="mt-2 text-sm text-slate-400">Unified Dashboard · Pilot</p>
          </div>

          <form onSubmit={submit} className="rounded-3xl bg-white/95 backdrop-blur p-7 shadow-2xl shadow-black/40 ring-1 ring-white/20 text-slate-800">
            <div className="mb-5">
              <h2 className="text-lg font-bold">Selamat datang kembali</h2>
              <p className="text-xs text-slate-500 mt-1">Masuk untuk mengakses 4 module.</p>
            </div>

            <label className="block text-sm">
              <span className="text-slate-700">Username</span>
              <div className="mt-1.5 relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </label>

            <label className="block text-sm mt-4">
              <span className="text-slate-700">Password</span>
              <div className="mt-1.5 relative">
                <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </label>

            {error && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/30 hover:shadow-lg hover:-translate-y-0.5 transition focus-ring disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {busy ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Memverifikasi…
                </>
              ) : (
                "Sign in"
              )}
            </button>

            <div className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 leading-relaxed">
              <strong className="text-slate-700">Default kredensial:</strong>{" "}
              <code className="rounded bg-slate-200 px-1 py-0.5 font-mono">owner</code> /{" "}
              <code className="rounded bg-slate-200 px-1 py-0.5 font-mono">owner123</code>{" "}
              — ganti sebelum produksi.
            </div>
          </form>

          <p className="mt-6 text-center text-[11px] text-slate-500">
            YKP HERMEZ AI Command Center · v0.1.0
          </p>
        </div>
      </div>
    </div>
  );
}