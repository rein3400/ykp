'use client';

import { useState } from 'react';

/**
 * Reusable "Hubungkan Telegram" client component.
 * Flow for non-techy staff:
 *   1. Tap "Dapatkan Kode" → server returns a 6-char code.
 *   2. Tap "Buka Telegram" → deep-link t.me/<bot>?start=<KODE> opens Telegram
 *      and the bot auto-connects (no typing).
 */
export function TelegramLinkClient({ linkPath }: { linkPath: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bot username from env (set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME). Fallback
  // to a placeholder so the page still renders in dev.
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'justatestermaybot';
  const deepLink = code ? `https://t.me/${botUsername}?start=${code}` : null;

  async function getCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(linkPath, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Gagal mendapatkan kode');
      setCode(json.data.code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mendapatkan kode');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='max-w-md space-y-6'>
      {/* Step 1: get code */}
      <div className='rounded-xl border bg-card p-6 shadow-sm'>
        <h2 className='text-lg font-semibold'>1. Dapatkan kode</h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Tekan tombol di bawah untuk membuat kode koneksi.
        </p>
        <button
          onClick={getCode}
          disabled={busy}
          className='mt-4 w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50'
        >
          {busy ? 'Membuat kode…' : code ? 'Buat kode baru' : 'Dapatkan Kode'}
        </button>
        {error && <p className='mt-3 text-sm text-red-600'>{error}</p>}
      </div>

      {/* Step 2: show code + open telegram */}
      {code && (
        <div className='rounded-xl border bg-card p-6 shadow-sm'>
          <h2 className='text-lg font-semibold'>2. Buka Telegram</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Kode kamu (berlaku 10 menit):
          </p>
          <div className='mt-3 rounded-lg bg-slate-100 py-4 text-center font-mono text-4xl font-bold tracking-widest text-blue-700'>
            {code}
          </div>
          {deepLink && (
            <a
              href={deepLink}
              target='_blank'
              rel='noopener noreferrer'
              className='mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800'
            >
              <span>📱</span> Buka Telegram
            </a>
          )}
          <p className='mt-3 text-xs text-muted-foreground'>
            Telegram akan terbuka dan bot otomatis menghubungkan akun kamu. Tidak perlu mengetik apa pun.
          </p>
        </div>
      )}

      {/* Step 3: done */}
      {code && (
        <div className='rounded-xl border bg-card p-6 shadow-sm'>
          <h2 className='text-lg font-semibold'>3. Selesai</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Setelah bot mengonfirmasi, akun kamu terhubung. Kamu bisa menerima notifikasi dan bertanya ke Hermez.
          </p>
        </div>
      )}
    </div>
  );
}
