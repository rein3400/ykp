'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/toast';

export function AdjustmentForm({ employees }: { employees: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    employee_id: employees[0]?.id ?? '',
    adjustment_type: 'BONUS',
    amount: '',
    reason: '',
    payroll_period: new Date().toISOString().slice(0, 7),
    date: new Date().toISOString().slice(0, 10),
    attachment_url: ''
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const needsBukti = form.adjustment_type === 'REIMBURSEMENT';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      setError('Amount wajib diisi lebih dari 0.');
      return;
    }
    if (!form.reason.trim()) {
      setError('Alasan wajib diisi.');
      return;
    }
    if (needsBukti && !form.attachment_url.trim()) {
      setError('Reimburse wajib isi URL bukti (foto struk / link Google Drive).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/hr/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? 'Gagal');
      }
      toast.success('Adjustment ditambahkan', 'Menunggu approval owner.');
      router.refresh();
      setForm({ ...form, amount: '', reason: '', attachment_url: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className='grid gap-3'>
      <label className='text-sm'>
        Karyawan
        <select className='input mt-1 w-full' value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} required>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </label>
      <div className='grid grid-cols-2 gap-3'>
        <label className='text-sm'>
          Tipe
          <select className='input mt-1 w-full' value={form.adjustment_type} onChange={(e) => set('adjustment_type', e.target.value)}>
            <option value='BONUS'>Bonus</option>
            <option value='PENALTY'>Penalty</option>
            <option value='OVERTIME'>Lembur</option>
            <option value='ALLOWANCE'>Tunjangan</option>
            <option value='CASH_ADVANCE'>Kasbon</option>
            <option value='REIMBURSEMENT'>Reimburse</option>
          </select>
        </label>
        <label className='text-sm'>
          Tanggal
          <input type='date' className='input mt-1 w-full' value={form.date} onChange={(e) => set('date', e.target.value)} required />
        </label>
      </div>
      <label className='text-sm'>
        Amount (Rp)
        <input type='number' min='0' className='input mt-1 w-full' value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
      </label>
      <label className='text-sm'>
        Periode Payroll (YYYY-MM)
        <input type='month' className='input mt-1 w-full' value={form.payroll_period} onChange={(e) => set('payroll_period', e.target.value)} required />
      </label>
      <label className='text-sm'>
        Alasan
        <textarea className='input mt-1 w-full' rows={2} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
      </label>
      <label className='text-sm'>
        URL Bukti {needsBukti ? <span className='text-rose-600'>(wajib untuk Reimburse)</span> : <span className='text-slate-400'>(opsional)</span>}
        <input
          type='url'
          className='input mt-1 w-full'
          placeholder='https://drive.google.com/... atau link foto struk'
          value={form.attachment_url}
          onChange={(e) => set('attachment_url', e.target.value)}
          required={needsBukti}
        />
        <span className='mt-1 block text-xs text-slate-500'>
          Upload dulu ke Drive/WhatsApp → salin link-nya ke sini. Belum ada upload file langsung di form.
        </span>
      </label>
      {error && <div role='alert' className='rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700'>{error}</div>}
      <button type='submit' disabled={saving} className='btn-primary'>{saving ? 'Menyimpan…' : 'Simpan'}</button>
    </form>
  );
}