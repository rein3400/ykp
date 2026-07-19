'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/toast';

export function LeaveForm({ employees }: { employees: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    employee_id: employees[0]?.id ?? '',
    leave_type: 'PERMISSION',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: ''
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.end_date < form.start_date) {
      setError('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }
    if (!form.reason.trim()) {
      setError('Alasan wajib diisi.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/hr/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? 'Gagal');
      }
      toast.success('Pengajuan terkirim', 'Menunggu approval.');
      router.refresh();
      setForm({ ...form, reason: '' });
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
      <label className='text-sm'>
        Tipe
        <select className='input mt-1 w-full' value={form.leave_type} onChange={(e) => set('leave_type', e.target.value)}>
          <option value='ANNUAL_LEAVE'>Cuti Tahunan</option>
          <option value='SICK'>Sakit</option>
          <option value='PERMISSION'>Izin</option>
          <option value='UNPAID_LEAVE'>Cuti Tidak Dibayar</option>
          <option value='EMERGENCY'>Darurat</option>
          <option value='MATERNITY'>Melahirkan</option>
        </select>
      </label>
      <div className='grid grid-cols-2 gap-3'>
        <label className='text-sm'>
          Mulai
          <input type='date' className='input mt-1 w-full' value={form.start_date} onChange={(e) => set('start_date', e.target.value)} required />
        </label>
        <label className='text-sm'>
          Selesai
          <input type='date' className='input mt-1 w-full' value={form.end_date} onChange={(e) => set('end_date', e.target.value)} required />
        </label>
      </div>
      <label className='text-sm'>
        Alasan
        <textarea className='input mt-1 w-full' rows={2} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
      </label>
      {error && <div role='alert' className='rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700'>{error}</div>}
      <button type='submit' disabled={saving} className='btn-primary'>{saving ? 'Mengirim…' : 'Ajukan'}</button>
    </form>
  );
}