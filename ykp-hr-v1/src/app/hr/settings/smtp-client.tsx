'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SmtpForm {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_secure: string;
  smtp_from_name: string;
}

const EMPTY: SmtpForm = {
  smtp_host: 'smtp.gmail.com',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  smtp_secure: 'false',
  smtp_from_name: 'YKP HR'
};

export default function SmtpClient() {
  const [form, setForm] = useState<SmtpForm>(EMPTY);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [testTo, setTestTo] = useState('');
  const [passDirty, setPassDirty] = useState(false);

  useEffect(() => {
    fetch('/api/hr/settings/smtp')
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setForm({
            smtp_host: j.data.smtp_host || 'smtp.gmail.com',
            smtp_port: j.data.smtp_port || '587',
            smtp_user: j.data.smtp_user || '',
            smtp_pass: j.data.smtp_pass || '',
            smtp_secure: j.data.smtp_secure || 'false',
            smtp_from_name: j.data.smtp_from_name || 'YKP HR'
          });
          setConfigured(j.data.configured === 'true');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setErr('');
    setBusy(true);
    try {
      const body: Record<string, string> = {
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
        smtp_user: form.smtp_user,
        smtp_secure: form.smtp_secure,
        smtp_from_name: form.smtp_from_name
      };
      // Empty pass field = keep existing (mask display)
      if (passDirty) body.smtp_pass = form.smtp_pass;
      const r = await fetch('/api/hr/settings/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await r.json();
      if (!r.ok) { setErr(j?.error?.message ?? 'Gagal menyimpan'); return; }
      setForm((f) => ({ ...f, smtp_pass: j.data?.smtp_pass || '' }));
      setPassDirty(false);
      setConfigured(j.data?.configured === 'true');
      toast.success('Setting email tersimpan');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setErr('');
    if (!testTo.trim()) { setErr('Isi email tujuan tes terlebih dahulu.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/hr/settings/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testTo.trim() })
      });
      const j = await r.json();
      if (!r.ok) { setErr(j?.error?.message ?? 'Tes gagal'); return; }
      toast.success(`Email tes terkirim ke ${j.data?.to ?? testTo}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className='text-sm text-slate-500'>Memuat…</p>;

  return (
    <div className='max-w-xl space-y-3'>
      {err && (
        <div role='alert' className='rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>{err}</div>
      )}

      <div className={`rounded border px-3 py-2 text-sm ${configured ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        {configured
          ? '✓ SMTP terkonfigurasi — slip gaji akan terkirim otomatis.'
          : 'SMTP belum lengkap — slip gaji masih mode log (tidak terkirim sungguhan).'}
      </div>

      <div className='space-y-2 rounded border border-slate-200 bg-white p-3'>
        <label className='block text-xs font-medium'>
          SMTP Host
          <input value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
            className='mt-1 w-full rounded border px-2 py-1.5 text-sm' placeholder='smtp.gmail.com' />
        </label>
        <div className='grid grid-cols-2 gap-2'>
          <label className='text-[11px] font-medium text-slate-600'>
            Port
            <select value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: e.target.value, smtp_secure: e.target.value === '465' ? 'true' : 'false' })}
              className='mt-1 w-full rounded border px-2 py-1.5 text-sm'>
              <option value='587'>587 (STARTTLS)</option>
              <option value='465'>465 (SSL)</option>
              <option value='25'>25</option>
            </select>
          </label>
          <label className='text-[11px] font-medium text-slate-600'>
            Nama Pengirim
            <input value={form.smtp_from_name} onChange={(e) => setForm({ ...form, smtp_from_name: e.target.value })}
              className='mt-1 w-full rounded border px-2 py-1.5 text-sm' placeholder='YKP HR' />
          </label>
        </div>
        <label className='block text-[11px] font-medium text-slate-600'>
          Email Pengirim (SMTP User) *
          <input value={form.smtp_user} onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
            className='mt-1 w-full rounded border px-2 py-1.5 text-sm' placeholder='funkydak@gmail.com' />
        </label>
        <label className='block text-[11px] font-medium text-slate-600'>
          App Password {configured && !passDirty && <span className='text-slate-500'>(tidak diubah bila dibiarkan kosong)</span>}
          <input
            type='password'
            value={form.smtp_pass}
            onChange={(e) => { setForm({ ...form, smtp_pass: e.target.value }); setPassDirty(true); }}
            className='mt-1 w-full rounded border px-2 py-1.5 text-sm'
            placeholder={configured ? '•••••••• (tersimpan)' : '16 huruf App Password Gmail'}
          />
        </label>
        <label className='flex items-center gap-2 text-[11px] text-slate-600'>
          <input type='checkbox' checked={form.smtp_secure === 'true'} onChange={(e) => setForm({ ...form, smtp_secure: e.target.checked ? 'true' : 'false' })} />
          Gunakan SSL langsung (hanya untuk port 465)
        </label>
        <button onClick={save} disabled={busy} className='rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50'>
          {busy ? 'Menyimpan…' : 'Simpan Setting'}
        </button>
      </div>

      <div className='space-y-2 rounded border border-slate-200 bg-white p-3'>
        <h2 className='text-sm font-semibold'>Tes Kirim Email</h2>
        <p className='text-[11px] text-slate-500'>Kirim email percobaan untuk memastikan setting benar sebelum dipakai kirim slip.</p>
        <div className='flex gap-2'>
          <input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            className='flex-1 rounded border px-2 py-1.5 text-sm'
            aria-label='Email tujuan tes'
            placeholder='email tujuan tes'
          />
          <button onClick={sendTest} disabled={busy} className='rounded border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50'>
            Kirim Email Tes
          </button>
        </div>
      </div>

      <div className='rounded border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900'>
        <p className='font-semibold mb-1'>Cara mendapatkan App Password Gmail:</p>
        <ol className='list-decimal pl-4 space-y-0.5'>
          <li>Aktifkan Verifikasi 2 Langkah di <b>myaccount.google.com → Keamanan</b></li>
          <li>Buka <b>myaccount.google.com/apppasswords</b></li>
          <li>Buat dengan nama &quot;YKP HR Slip Gaji&quot; → salin 16 huruf</li>
          <li>Tempel di kolom App Password di atas (tanpa spasi)</li>
        </ol>
      </div>
    </div>
  );
}