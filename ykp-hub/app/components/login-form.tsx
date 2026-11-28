"use client";
import { useState } from "react";
import { HubLogo, UserIcon, LockIcon } from "./icons";
import { isGoogleAuthEnabledClient } from "../lib/auth-flags";

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
}

export function LoginForm({ onLogin }: Props) {
  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const googleOn = isGoogleAuthEnabledClient();

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

  async function handleGoogle() {
    setError(null);
    if (!googleOn) {
      // Google login is not provisioned yet — steer the user to the YKP account.
      document.getElementById("hub-username")?.focus();
      return;
    }
    try {
      const r = await fetch("/api/auth/google", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      setError(j?.error?.message ?? "Google login belum tersedia");
    } catch {
      setError("Gagal menghubungi server");
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0b0b] text-white animate-fade-in">
      <div
        className="absolute inset-0"
        style={{ backgroundImage: "radial-gradient(at 18% 12%, rgba(224,16,32,0.38) 0px, transparent 55%)" }}
      />
      <div className="absolute inset-0 grid-pattern opacity-60" />

      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-ink shadow-2xl shadow-black/50 ring-1 ring-white/10 animate-slide-up md:grid-cols-2">
          {/* Hero — YKP red identity */}
          <div className="gradient-brand flex flex-col justify-between p-8 text-white md:p-10">
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <HubLogo className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold tracking-wide">YKP HUB</span>
            </div>
            <div className="my-10">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/70">Orkestrasi Sistem</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">
                SATU AKUN UNTUK RUANG KERJA YKP
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-white/85">
                Masuk dengan akun Google yang diberi akses, lalu konfirmasi dengan PIN untuk
                membuka modul sesuai peran.
              </p>
            </div>
            <p className="text-[11px] text-white/60">PT YKP Global Utama · Ruang kerja tim YKP</p>
          </div>

          {/* Form card */}
          <div className="bg-white p-7 text-slate-800 md:p-9">
            <div className="mb-6">
              <span className="inline-flex h-6 items-center rounded-full bg-red-50 px-2.5 text-[11px] font-semibold text-[#E01020]">
                01 · Akun Google
              </span>
              <h2 className="mt-3 text-xl font-bold text-ink">Masuk ke ruang kerja</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Coba alur masuk melalui Google, lalu konfirmasi dengan PIN untuk membuka modul
                sesuai peran.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl gradient-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-ring"
            >
              Simulasikan login Google ›
            </button>
            {!googleOn && (
              <p className="mt-2 text-[11px] text-slate-400">
                Google login belum aktif — gunakan akun YKP di bawah.
              </p>
            )}

            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              atau akun YKP
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={submit} className="space-y-4">
              <label htmlFor="hub-username" className="block text-sm">
                <span className="text-slate-700">Username</span>
                <div className="relative mt-1.5">
                  <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="hub-username"
                    className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm transition placeholder:text-slate-400 focus:border-[#E01020] focus:outline-none focus:ring-2 focus:ring-[#E01020]/30"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </label>

              <label htmlFor="hub-password" className="block text-sm">
                <span className="text-slate-700">Password</span>
                <div className="relative mt-1.5">
                  <LockIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="hub-password"
                    type="password"
                    className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm transition placeholder:text-slate-400 focus:border-[#E01020] focus:outline-none focus:ring-2 focus:ring-[#E01020]/30"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </label>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 animate-fade-in"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !username.trim() || !password}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-black focus-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Memverifikasi…
                  </>
                ) : (
                  "Masuk"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
