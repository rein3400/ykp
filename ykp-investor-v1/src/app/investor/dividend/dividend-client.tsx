'use client';
import { useState } from 'react';

export default function DividendClient({
  rows, investors, isOwner
}: { rows: Record<string, string>[]; investors: Record<string, string>[]; isOwner: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ investor_id: '', period: '', amount: '', status: 'declared', reference: '' });
  const [list, setList] = useState(rows);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    const r = await fetch('/api/investor/dividend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([j.data, ...list]);
    setShowForm(false);
  }

  return (
    <div className='space-y-3'>
      {isOwner && (
        <button onClick={() => setShowForm(!showForm)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
          {showForm ? 'Tutup' : '+ Declare Dividend'}
        </button>
      )}
      {showForm && (
        <div className='rounded border border-border bg-background p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
            <select aria-label='Investor' value={form.investor_id} onChange={(e) => setForm({ ...form, investor_id: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value=''>Investor</option>
              {investors.map((i) => <option key={i.investor_id} value={i.investor_id}>{i.investor_name}</option>)}
            </select>
            <input aria-label='Periode (YYYY-MM)' placeholder='Period (YYYY-MM)' value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <input aria-label='Nominal' placeholder='Amount' value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
            <select aria-label='Status' value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className='rounded border border-border px-2 py-1 text-xs'>
              <option value='declared'>Declared</option>
              <option value='paid'>Paid</option>
            </select>
            <input aria-label='Referensi' placeholder='Reference' value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className='rounded border border-border px-2 py-1 text-xs' />
          </div>
          {err && <p className='text-xs text-destructive'>{err}</p>}
          <button onClick={create} className='rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'>Simpan</button>
        </div>
      )}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Period</th><th className='px-2 py-1 text-left'>Investor</th>
              <th className='px-2 py-1 text-right'>Amount</th><th className='px-2 py-1 text-center'>Status</th>
              <th className='px-2 py-1 text-left'>Declared</th><th className='px-2 py-1 text-left'>Paid</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const inv = investors.find((i) => i.investor_id === r.investor_id);
              return (
                <tr key={r.dividend_id} className='border-t border-border'>
                  <td className='px-2 py-1'>{r.period}</td>
                  <td className='px-2 py-1'>{inv?.investor_name ?? r.investor_id}</td>
                  <td className='px-2 py-1 text-right'>{formatRp(r.amount)}</td>
                  <td className='px-2 py-1 text-center'>
                    <span className={r.status === 'paid' ? 'text-success font-medium' : 'text-warning'}>{r.status}</span>
                  </td>
                  <td className='px-2 py-1'>{r.declared_at}</td>
                  <td className='px-2 py-1'>{r.paid_at || '-'}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={6} className='px-2 py-3 text-center text-muted-foreground'>Belum ada dividen.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatRp(n: string) { const v = Number(n || 0); if (!v) return '-'; return new Intl.NumberFormat('id-ID').format(v); }