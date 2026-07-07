'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RosterForm({ employees, shifts }: { employees: { id: string; name: string }[]; shifts: { shift_id: string; shift_name: string }[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    employee_id: employees[0]?.id ?? '',
    shift_id: shifts[0]?.shift_id ?? '',
    date: new Date().toISOString().slice(0, 10),
    roster_status: 'SCHEDULED',
    notes: ''
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/hr/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? 'Gagal');
      }
      router.refresh();
      setForm({ ...form, notes: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className='grid gap-3'>
      <h2 className='mb-2 font-semibold'>Assign Shift</h2>
      <label className='text-sm'>
        Karyawan
        <select className='input mt-1 w-full' value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} required>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </label>
      <label className='text-sm'>
        Shift
        <select className='input mt-1 w-full' value={form.shift_id} onChange={(e) => set('shift_id', e.target.value)} required>
          {shifts.map((s) => (
            <option key={s.shift_id} value={s.shift_id}>{s.shift_name || s.shift_id}</option>
          ))}
        </select>
      </label>
      <label className='text-sm'>
        Tanggal
        <input type='date' className='input mt-1 w-full' value={form.date} onChange={(e) => set('date', e.target.value)} required />
      </label>
      <label className='text-sm'>
        Catatan
        <textarea className='input mt-1 w-full' rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
      {error && <div className='text-sm text-red-600'>{error}</div>}
      <button type='submit' disabled={saving} className='btn-primary'>{saving ? '...' : 'Simpan'}</button>
    </form>
  );
}