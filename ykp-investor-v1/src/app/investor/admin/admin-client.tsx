'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PhotoUpload from '@/components/photo-upload';

type Row = Record<string, string>;
interface InvestorRow {
  investor_id: string;
  investor_name: string;
  investor_type: string;
  status: string;
  join_date: string;
  shareholding: Row[];
  documents: Row[];
  login_username: string;
}

const inputCls = 'w-full rounded border border-border px-2 py-1.5 text-xs';
const labelCls = 'mb-1 block text-[10px] font-medium uppercase text-muted-foreground';

function formatIdr(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v || '-';
  return `Rp${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function expiryChip(expiry: string, today: string): { text: string; cls: string } | null {
  if (!expiry) return null;
  const days = Math.floor((Date.parse(expiry) - Date.parse(today)) / 86400000);
  if (days < 0) return { text: `MOU expired ${expiry}`, cls: 'bg-red-100 text-red-800' };
  if (days <= 30) return { text: `MOU berakhir ${days}h lagi`, cls: 'bg-amber-100 text-amber-800' };
  return { text: `MOU s.d. ${expiry}`, cls: 'bg-emerald-100 text-emerald-800' };
}

export default function AdminClient({
  investors, brands, dividends, today
}: {
  investors: InvestorRow[]; brands: Row[]; dividends: Row[]; today: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mouId, setMouId] = useState('');
  const [form, setForm] = useState({
    investor_name: '', username: '', password: '', email: '', phone: '', company: '',
    investor_type: 'individual', join_date: today, brand_id: brands[0]?.brand_id ?? '',
    share_pct: '', mou_signed_date: '', mou_expiry_date: ''
  });
  const [shareEdits, setShareEdits] = useState<Record<string, { pct: string; eff: string }>>({});
  const [period, setPeriod] = useState(today.slice(0, 7));
  const [proposeMsg, setProposeMsg] = useState<string | null>(null);

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  async function create() {
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch('/api/investor/admin/investors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investor_name: form.investor_name,
          username: form.username,
          password: form.password,
          email: form.email,
          phone: form.phone,
          company: form.company,
          investor_type: form.investor_type,
          join_date: form.join_date,
          brand_id: form.brand_id,
          brand_name: brands.find((b) => b.brand_id === form.brand_id)?.brand_name ?? '',
          share_pct: form.share_pct,
          mou_attachment_id: mouId || undefined,
          mou_signed_date: form.mou_signed_date || undefined,
          mou_expiry_date: form.mou_expiry_date || undefined
        })
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? 'Gagal menyimpan'); return; }
      setShowForm(false);
      setMouId('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveShare(investorId: string, brandId: string, brandName: string) {
    const edit = shareEdits[`${investorId}/${brandId}`];
    if (!edit?.pct) return;
    const r = await fetch('/api/investor/admin/shareholding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        investor_id: investorId, brand_id: brandId, brand_name: brandName,
        share_pct: edit.pct, effective_date: edit.eff || today
      })
    });
    const j = await r.json();
    if (!r.ok) { alert(j.error?.message ?? 'Gagal'); return; }
    router.refresh();
  }

  async function propose() {
    setProposeMsg(null);
    setBusy(true);
    try {
      const r = await fetch('/api/investor/dividend/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period })
      });
      const j = await r.json();
      if (!r.ok) { setProposeMsg(j.error?.message ?? 'Gagal'); return; }
      setProposeMsg(`✅ ${j.data.proposed.length} proposal dibuat, ${j.data.skipped.length} dilewati`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function transition(dividendId: string, action: 'declare' | 'pay') {
    const r = await fetch('/api/investor/dividend', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dividend_id: dividendId, action })
    });
    const j = await r.json();
    if (!r.ok) { alert(j.error?.message ?? 'Gagal'); return; }
    router.refresh();
  }

  return (
    <div className='space-y-4'>
      <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
        {showForm ? 'Tutup' : '+ Investor Baru'}
      </button>

      {showForm && (
        <div className='max-w-2xl space-y-2 rounded border border-border bg-background p-3'>
          <p className='text-xs font-bold'>Akun investor baru</p>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
            <label className='block'><span className={labelCls}>Nama *</span>
              <input value={form.investor_name} onChange={(e) => update('investor_name', e.target.value)} className={inputCls} /></label>
            <label className='block'><span className={labelCls}>Username *</span>
              <input value={form.username} onChange={(e) => update('username', e.target.value)} className={inputCls} /></label>
            <label className='block'><span className={labelCls}>Password *</span>
              <input type='password' value={form.password} onChange={(e) => update('password', e.target.value)} className={inputCls} /></label>
            <label className='block'><span className={labelCls}>Email</span>
              <input value={form.email} onChange={(e) => update('email', e.target.value)} className={inputCls} /></label>
            <label className='block'><span className={labelCls}>Telepon</span>
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)} className={inputCls} /></label>
            <label className='block'><span className={labelCls}>Perusahaan</span>
              <input value={form.company} onChange={(e) => update('company', e.target.value)} className={inputCls} /></label>
            <label className='block'><span className={labelCls}>Tipe</span>
              <select value={form.investor_type} onChange={(e) => update('investor_type', e.target.value)} className={inputCls}>
                <option value='individual'>Individual</option>
                <option value='company'>Company</option>
              </select></label>
            <label className='block'><span className={labelCls}>Tanggal bergabung</span>
              <input type='date' value={form.join_date} onChange={(e) => update('join_date', e.target.value)} className={inputCls} /></label>
            <label className='block'><span className={labelCls}>Brand *</span>
              <select value={form.brand_id} onChange={(e) => update('brand_id', e.target.value)} className={inputCls}>
                {brands.map((b) => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
              </select></label>
            <label className='block'><span className={labelCls}>% Bagi hasil *</span>
              <input type='number' min='0' max='100' step='0.1' value={form.share_pct} onChange={(e) => update('share_pct', e.target.value)} className={inputCls} /></label>
            <label className='block'><span className={labelCls}>MOU ditandatangani</span>
              <input type='date' value={form.mou_signed_date} onChange={(e) => update('mou_signed_date', e.target.value)} className={inputCls} /></label>
            <label className='block'><span className={labelCls}>MOU berakhir</span>
              <input type='date' value={form.mou_expiry_date} onChange={(e) => update('mou_expiry_date', e.target.value)} className={inputCls} /></label>
          </div>
          <PhotoUpload entityType='mou' onUploaded={setMouId} label='MOU (foto/PDF)' allowPdf />
          {err && <p className='text-xs text-destructive'>{err}</p>}
          <button onClick={create} disabled={busy} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50'>
            {busy ? 'Menyimpan…' : 'Simpan Investor'}
          </button>
        </div>
      )}

      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-left text-xs'>
          <thead>
            <tr className='border-b border-border bg-muted text-[10px] uppercase text-muted-foreground'>
              <th className='px-2 py-1.5 font-medium'>Investor</th>
              <th className='px-2 py-1.5 font-medium'>Login</th>
              <th className='px-2 py-1.5 font-medium'>Bagi hasil</th>
              <th className='px-2 py-1.5 font-medium'>MOU</th>
            </tr>
          </thead>
          <tbody>
            {investors.length === 0 && (
              <tr><td colSpan={4} className='px-2 py-6 text-center text-muted-foreground'>Belum ada investor.</td></tr>
            )}
            {investors.map((inv) => (
              <tr key={inv.investor_id} className='border-b border-border/50 align-top'>
                <td className='px-2 py-1.5'>
                  <p className='font-semibold'>{inv.investor_name}</p>
                  <p className='text-[10px] text-muted-foreground'>{inv.investor_type} · {inv.status} · gabung {inv.join_date}</p>
                </td>
                <td className='px-2 py-1.5'>{inv.login_username || '—'}</td>
                <td className='px-2 py-1.5'>
                  {inv.shareholding.map((sh) => {
                    const key = `${inv.investor_id}/${sh.brand_id}`;
                    const edit = shareEdits[key] ?? { pct: '', eff: '' };
                    return (
                      <div key={sh.brand_id} className='mb-1 flex flex-wrap items-center gap-1'>
                        <span className='font-medium'>{sh.brand_name || sh.brand_id}:</span>
                        <span className='font-bold'>{sh.share_pct}%</span>
                        <input
                          type='number' min='0' max='100' step='0.1' placeholder='% baru'
                          value={edit.pct}
                          onChange={(e) => setShareEdits({ ...shareEdits, [key]: { ...edit, pct: e.target.value } })}
                          className='w-16 rounded border border-border px-1 py-0.5 text-[10px]'
                        />
                        <input
                          type='date'
                          value={edit.eff}
                          onChange={(e) => setShareEdits({ ...shareEdits, [key]: { ...edit, eff: e.target.value } })}
                          className='rounded border border-border px-1 py-0.5 text-[10px]'
                        />
                        <button
                          onClick={() => saveShare(inv.investor_id, sh.brand_id, sh.brand_name)}
                          disabled={!edit.pct}
                          className='rounded border border-border px-1.5 py-0.5 text-[10px] disabled:opacity-40'
                        >
                          Simpan
                        </button>
                      </div>
                    );
                  })}
                </td>
                <td className='px-2 py-1.5'>
                  {inv.documents.length === 0 && <span className='text-muted-foreground'>—</span>}
                  {inv.documents.map((d) => {
                    const chip = expiryChip(d.expiry_date, today);
                    return (
                      <div key={d.doc_id} className='mb-1 space-y-0.5'>
                        <a href={`/api/investor/attachments/${d.attachment_id}/file`} target='_blank' rel='noreferrer' className='text-primary underline'>
                          {d.doc_type}
                        </a>
                        {chip && (
                          <span className={`ml-1 rounded px-1 py-0.5 text-[9px] font-semibold ${chip.cls}`}>{chip.text}</span>
                        )}
                      </div>
                    );
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className='rounded border border-border bg-background p-3'>
        <p className='mb-2 text-xs font-bold'>Proposal dividen otomatis (profit brand × % bagi hasil)</p>
        <div className='flex flex-wrap items-center gap-2'>
          <input type='month' value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls + ' w-40'} />
          <button onClick={propose} disabled={busy} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50'>
            {busy ? 'Memproses…' : 'Buat Proposal'}
          </button>
          {proposeMsg && <span className='text-[11px]'>{proposeMsg}</span>}
        </div>
        <div className='mt-3 overflow-x-auto'>
          <table className='w-full text-left text-xs'>
            <thead>
              <tr className='border-b border-border text-[10px] uppercase text-muted-foreground'>
                <th className='py-1 pr-3 font-medium'>Periode</th>
                <th className='py-1 pr-3 font-medium'>Investor</th>
                <th className='py-1 pr-3 text-right font-medium'>Jumlah</th>
                <th className='py-1 pr-3 font-medium'>Status</th>
                <th className='py-1 pr-3 font-medium'>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dividends.map((d) => (
                <tr key={d.dividend_id} className='border-b border-border/50'>
                  <td className='py-1 pr-3'>{d.period}</td>
                  <td className='py-1 pr-3'>{investors.find((i) => i.investor_id === d.investor_id)?.investor_name ?? d.investor_id}</td>
                  <td className='py-1 pr-3 text-right font-semibold'>{formatIdr(d.amount)}</td>
                  <td className='py-1 pr-3'>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      d.status === 'paid' ? 'bg-emerald-100 text-emerald-800'
                      : d.status === 'declared' ? 'bg-sky-100 text-sky-800'
                      : 'bg-amber-100 text-amber-800'
                    }`}>{d.status}</span>
                  </td>
                  <td className='py-1 pr-3'>
                    {d.status === 'proposed' && (
                      <button onClick={() => transition(d.dividend_id, 'declare')} className='rounded border border-border px-1.5 py-0.5 text-[10px]'>Declare</button>
                    )}
                    {d.status === 'declared' && (
                      <button onClick={() => transition(d.dividend_id, 'pay')} className='rounded border border-border px-1.5 py-0.5 text-[10px]'>Mark paid</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
