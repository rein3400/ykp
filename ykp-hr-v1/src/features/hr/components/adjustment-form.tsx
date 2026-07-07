'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdjustmentForm({ employees }: { employees: { id: string; name: string }[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    employee_id: employees[0]?.id ?? '',
    adjustment_type: 'BONUS',
    amount: '',
    reason: '',
    payroll_period: new Date().toISOString().slice(0, 7),
    date: new Date().toISOString().slice(0, 10)
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
      router.refresh();
      setForm({ ...form, amount: '', reason: '' });
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
      {error && <div className='text-sm text-red-600'>{error}</div>}
      <button type='submit' disabled={saving} className='btn-primary'>{saving ? '...' : 'Simpan'}</button>
    </form>
  );
}