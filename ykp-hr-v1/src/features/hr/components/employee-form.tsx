'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface EmployeeInitial {
  employee_id?: string;
  full_name?: string;
  nickname?: string;
  gender?: string;
  phone?: string;
  email?: string;
  role?: string;
  position?: string;
  brand_id?: string;
  outlet_id?: string;
  basic_salary?: string | number;
  salary_type?: string;
  employment_status?: string;
  join_date?: string;
  bank_name?: string;
  bank_account?: string;
  account_holder?: string;
}

export function EmployeeForm({ initial, mode }: { initial?: EmployeeInitial; mode: 'create' | 'edit' }) {
  const router = useRouter();
  const employeeId = initial?.employee_id ?? '';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    full_name: initial?.full_name ?? '',
    nickname: initial?.nickname ?? '',
    gender: initial?.gender ?? 'M',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    role: initial?.role ?? 'staff',
    position: initial?.position ?? '',
    brand_id: initial?.brand_id ?? 'BR-001',
    outlet_id: initial?.outlet_id ?? '',
    basic_salary: initial?.basic_salary != null ? String(initial.basic_salary) : '',
    salary_type: initial?.salary_type ?? 'MONTHLY',
    employment_status: initial?.employment_status ?? 'PROBATION',
    join_date: initial?.join_date ?? new Date().toISOString().slice(0, 10),
    bank_name: initial?.bank_name ?? '',
    bank_account: initial?.bank_account ?? '',
    account_holder: initial?.account_holder ?? ''
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const url = mode === 'edit' ? `/api/hr/employees/${employeeId}` : '/api/hr/employees';
      const method = mode === 'edit' ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? 'Gagal menyimpan');
      }
      router.push('/hr/employees');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className='grid gap-3'>
      {mode === 'edit' && employeeId && (
        <div className='rounded-md border border-border bg-slate-50 px-3 py-2 text-sm'>
          <span className='text-muted-foreground'>Editing: </span>
          <span className='font-mono font-semibold'>{employeeId}</span>
        </div>
      )}
      <div className='grid grid-cols-2 gap-3'>
        <label className='text-sm'>
          Nama Lengkap *
          <input className='input mt-1 w-full' required value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
        </label>
        <label className='text-sm'>
          Nama Panggilan
          <input className='input mt-1 w-full' value={form.nickname} onChange={(e) => set('nickname', e.target.value)} />
        </label>
      </div>
      <div className='grid grid-cols-3 gap-3'>
        <label className='text-sm'>
          Gender
          <select className='input mt-1 w-full' value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value='M'>Laki-laki</option>
            <option value='F'>Perempuan</option>
          </select>
        </label>
        <label className='text-sm'>
          Role
          <select className='input mt-1 w-full' value={form.role} onChange={(e) => set('role', e.target.value)}>
            <option value='staff'>Staff</option>
            <option value='supervisor'>Supervisor</option>
            <option value='outlet_manager'>Outlet Manager</option>
            <option value='brand_manager'>Brand Manager</option>
          </select>
        </label>
        <label className='text-sm'>
          Posisi
          <input className='input mt-1 w-full' value={form.position} onChange={(e) => set('position', e.target.value)} />
        </label>
      </div>
      <div className='grid grid-cols-2 gap-3'>
        <label className='text-sm'>
          Brand *
          <select className='input mt-1 w-full' value={form.brand_id} onChange={(e) => set('brand_id', e.target.value)} required>
            <option value='BR-001'>Funkydak</option>
            <option value='BR-002'>Sekarpizza</option>
            <option value='BR-003'>Suburbuns</option>
            <option value='BR-004'>Laju Kopi</option>
            <option value='BR-005'>Uncle Masala</option>
          </select>
        </label>
        <label className='text-sm'>
          Outlet ID *
          <input className='input mt-1 w-full' placeholder='OL-001' value={form.outlet_id} onChange={(e) => set('outlet_id', e.target.value)} required />
        </label>
      </div>
      <div className='grid grid-cols-2 gap-3'>
        <label className='text-sm'>
          Telepon
          <input className='input mt-1 w-full' value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </label>
        <label className='text-sm'>
          Email
          <input className='input mt-1 w-full' type='email' value={form.email} onChange={(e) => set('email', e.target.value)} />
        </label>
      </div>
      <div className='grid grid-cols-3 gap-3'>
        <label className='text-sm'>
          Gaji Pokok (Rp) *
          <input className='input mt-1 w-full' type='number' min='0' required value={form.basic_salary} onChange={(e) => set('basic_salary', e.target.value)} />
        </label>
        <label className='text-sm'>
          Tipe Gaji
          <select className='input mt-1 w-full' value={form.salary_type} onChange={(e) => set('salary_type', e.target.value)}>
            <option value='MONTHLY'>Bulanan</option>
            <option value='DAILY'>Harian</option>
            <option value='SHIFT_BASED'>Per Shift</option>
            <option value='HOURLY'>Per Jam</option>
          </select>
        </label>
        <label className='text-sm'>
          Status Kerja
          <select className='input mt-1 w-full' value={form.employment_status} onChange={(e) => set('employment_status', e.target.value)}>
            <option value='PROBATION'>Probation</option>
            <option value='CONTRACT'>Kontrak</option>
            <option value='PERMANENT'>Tetap</option>
          </select>
        </label>
      </div>
      <label className='text-sm'>
        Tanggal Masuk *
        <input className='input mt-1 w-full' type='date' required value={form.join_date} onChange={(e) => set('join_date', e.target.value)} />
      </label>
      <div className='grid grid-cols-3 gap-3'>
        <label className='text-sm'>
          Bank
          <input className='input mt-1 w-full' value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
        </label>
        <label className='text-sm'>
          No Rekening
          <input className='input mt-1 w-full' value={form.bank_account} onChange={(e) => set('bank_account', e.target.value)} />
        </label>
        <label className='text-sm'>
          Atas Nama
          <input className='input mt-1 w-full' value={form.account_holder} onChange={(e) => set('account_holder', e.target.value)} />
        </label>
      </div>
      {error && <div className='text-sm text-red-600'>{error}</div>}
      <div className='flex gap-2'>
        <button type='submit' disabled={saving} className='btn-primary'>
          {saving ? 'Menyimpan...' : mode === 'edit' ? 'Update' : 'Simpan'}
        </button>
        <button type='button' onClick={() => router.back()} className='btn-ghost'>Batal</button>
      </div>
      <p className='text-xs text-muted-foreground'>
        Catatan: data rekening bank hanya bisa diliat HR Admin/Owner/Finance. Perubahan rekening wajib approval + audit log.
      </p>
    </form>
  );
}