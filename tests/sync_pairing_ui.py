import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

COMPONENT = """'use client';

import { useState } from 'react';

/**
 * Client component for the "Hubungkan Telegram" page.
 * Flow for non-techy staff:
 *   1. Tap "Dapatkan Kode" → server returns a 6-char code.
 *   2. Tap "Buka Telegram" (deep-link) OR copy the code and send
 *      `/start <KODE>` manually to the bot.
 *   3. Bot confirms and binds the Telegram chat id to the account.
 */
export function TelegramLinkClient({ linkPath }: { linkPath: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'command' | null>(null);

  // Bot username from env (set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME). Fallback
  // to a placeholder so the page still renders in dev.
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'ykp_hermez_bot';
  const deepLink = code ? `https://t.me/${botUsername}?start=${code}` : null;
  const command = code ? `/start ${code}` : null;

  async function getCode() {
    setBusy(true);
    setError(null);
    setCopied(null);
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

  async function copyText(text: string, kind: 'code' | 'command') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API can fail on non-HTTPS; fall back to a prompt-free no-op.
      setCopied(null);
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
          className='mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50'
        >
          {busy ? 'Membuat kode…' : code ? 'Buat kode baru' : 'Dapatkan Kode'}
        </button>
        {error && <p className='mt-3 text-sm text-red-600'>{error}</p>}
      </div>

      {/* Step 2: show code + open telegram */}
      {code && (
        <div className='rounded-xl border bg-card p-6 shadow-sm'>
          <h2 className='text-lg font-semibold'>2. Hubungkan ke Telegram</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Kode kamu (berlaku 10 menit):
          </p>
          <div className='mt-3 flex items-center gap-2'>
            <div className='flex-1 rounded-lg bg-slate-100 py-4 text-center font-mono text-4xl font-bold tracking-widest text-blue-700'>
              {code}
            </div>
            <button
              onClick={() => copyText(code, 'code')}
              className='rounded-lg border px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100'
            >
              {copied === 'code' ? 'Tersalin ✓' : 'Salin'}
            </button>
          </div>

          {deepLink && (
            <a
              href={deepLink}
              target='_blank'
              rel='noopener noreferrer'
              className='mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700'
            >
              <span>📱</span> Buka Telegram
            </a>
          )}

          {/* Manual fallback — deep-link only auto-sends /start on first-ever chat */}
          {command && (
            <div className='mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4'>
              <p className='text-sm font-medium text-amber-900'>
                Kalau tombol di atas tidak otomatis menghubungkan:
              </p>
              <ol className='mt-2 list-decimal space-y-1 pl-5 text-sm text-amber-800'>
                <li>Buka Telegram, cari <span className='font-mono font-semibold'>@{botUsername}</span></li>
                <li>Kirim pesan ini ke bot:</li>
              </ol>
              <div className='mt-2 flex items-center gap-2'>
                <code className='flex-1 rounded bg-white px-3 py-2 font-mono text-sm font-semibold text-slate-800'>
                  {command}
                </code>
                <button
                  onClick={() => copyText(command, 'command')}
                  className='rounded-lg border px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100'
                >
                  {copied === 'command' ? 'Tersalin ✓' : 'Salin'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: done */}
      {code && (
        <div className='rounded-xl border bg-card p-6 shadow-sm'>
          <h2 className='text-lg font-semibold'>3. Selesai</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Setelah bot membalas <span className='font-medium'>✅ Akun Telegram kamu berhasil terhubung</span>,
            kamu bisa menerima notifikasi dan bertanya ke Hermez.
          </p>
        </div>
      )}
    </div>
  );
}
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30)
sftp = c.open_sftp()

for app_dir in ["ykp-finance-v1", "ykp-warehouse-v1", "ykp-investor-v1", "ykp-ops-v1"]:
    path = f'/home/dev/ykp/{app_dir}/src/components/telegram-link-client.tsx'
    with sftp.open(path, 'w') as f:
        f.write(COMPONENT)
    print(f"OK {path}")

c.close()
print("DONE")
