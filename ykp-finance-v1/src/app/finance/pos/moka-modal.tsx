'use client';
/**
 * Moka connection + sync modal (Finance POS).
 * Opens the Moka authorize URL in a new tab, then polls status so the
 * Connect button flips to Sync/Disconnect once the callback completes.
 * Secondary to the CSV / Google Sheet import — which remains the primary path.
 */
import { useEffect, useState } from 'react';
import { Modal } from '../ui';

interface MokaState {
  configured: boolean;
  connected: boolean;
  merchant_id?: string;
  connected_at?: string;
}

export function MokaModal({ onClose, onSynced }: { onClose: () => void; onSynced: () => void }) {
  const [state, setState] = useState<MokaState>({ configured: false, connected: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [from, setFrom] = useState(() => new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    try {
      const res = await fetch('/api/moka/status');
      const j = await res.json();
      if (res.ok) setState(j.data as MokaState);
    } catch { /* keep defaults */ }
  }
  useEffect(() => { void load(); }, []);

  async function sync() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/moka/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? `HTTP ${res.status}`);
      setMsg(`Sinkronisasi selesai: ${j.data.inserted} baris masuk, ${j.data.skipped.length} dilewati, dari ${j.data.transactions_fetched} transaksi.`);
      onSynced();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Sync gagal');
    } finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true); setMsg('');
    try {
      await fetch('/api/moka/disconnect', { method: 'POST' });
      setMsg('Moka terputus.');
      await load();
    } finally { setBusy(false); }
  }

  return (
    <Modal title='Moka POS' onClose={onClose}>
      {!state.configured ? (
        <div className='space-y-2 text-xs'>
          <p className='text-muted-foreground'>
            Integrasi Moka belum dikonfigurasi di server. Set
            <code className='mx-1 font-mono'>MOKA_CLIENT_ID</code>,
            <code className='mx-1 font-mono'>MOKA_CLIENT_SECRET</code>, dan
            <code className='mx-1 font-mono'>MOKA_REDIRECT_URI</code>
            di env aplikasi.
          </p>
          <p className='text-[10px] text-muted-foreground'>Import manual (CSV / Google Sheet) tetap berfungsi normal tanpa ini.</p>
        </div>
      ) : !state.connected ? (
        <div className='space-y-3 text-xs'>
          <p>Hubungkan akun Moka untuk sinkronisasi penjualan langsung dari API Moka.
            Import manual (CSV / Google Sheet) tetap tersedia sebagai cara utama.</p>
          <button
            type='button'
            disabled={busy}
            onClick={() => { window.open('/api/moka/authorize', '_blank', 'noopener'); }}
            className='rounded bg-foreground px-3 py-1.5 text-xs text-background'
          >Hubungkan Moka</button>
          <p className='text-[10px] text-muted-foreground'>
            Setelah klik, akan terbuka halaman Moka. Selesaikan login + izin, lalu kembali ke sini —
            status akan berubah otomatis setelah 3 detik.
          </p>
        </div>
      ) : (
        <div className='space-y-3 text-xs'>
          <p><b>Terhubung</b> — merchant {state.merchant_id || '(id)'} sejak {state.connected_at || '-'}.</p>
          <div className='grid grid-cols-2 gap-2'>
            <label className='block'>
              <span className='mb-1 block text-[10px] text-muted-foreground'>Dari</span>
              <input type='date' value={from} onChange={(e) => setFrom(e.target.value)} className='w-full rounded border border-border px-2 py-1 text-xs' />
            </label>
            <label className='block'>
              <span className='mb-1 block text-[10px] text-muted-foreground'>Sampai</span>
              <input type='date' value={to} onChange={(e) => setTo(e.target.value)} className='w-full rounded border border-border px-2 py-1 text-xs' />
            </label>
          </div>
          <div className='flex gap-2'>
            <button
              type='button' disabled={busy} onClick={sync}
              className='flex-1 rounded bg-foreground px-3 py-1.5 text-xs text-background disabled:opacity-50'
            >{busy ? 'Sinkronisasi…' : 'Sinkronkan Sekarang'}</button>
            <button
              type='button' disabled={busy} onClick={disconnect}
              className='rounded border border-border px-3 py-1.5 text-xs'
            >Putuskan</button>
          </div>
        </div>
      )}
      {msg && <div className='mt-3 rounded border border-border p-2 text-[10px]'>{msg}</div>}
 <div className='mt-2 text-[10px] text-muted-foreground'>Import manual (CSV / Google Sheet) tetap menjadi cara utama — fitur ini hanya pelengkap.</div>
    </Modal>
  );
}