'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/toast';

interface EmpOpt { id: string; name: string; outlet_id: string }
interface OutletOpt { id: string; name: string }
interface AttendanceRow {
  attendance_id: string;
  date: string;
  employee_id: string;
  employee_name: string;
  outlet_id: string;
  actual_check_in: string;
  actual_check_out: string;
  attendance_status: string;
  late_minutes: string;
  overtime_minutes: string;
  notes: string;
}

async function fetchAttendance(): Promise<AttendanceRow[]> {
  const r = await fetch('/api/hr/attendance', { cache: 'no-store' });
  const j = await r.json();
  return j.data?.items ?? [];
}

export function AttendanceTable({ employees, outlets }: { employees: EmpOpt[]; outlets: OutletOpt[] }) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['attendance'],
    queryFn: fetchAttendance
  });
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    employee_id: employees[0]?.id ?? '',
    outlet_id: employees[0]?.outlet_id ?? outlets[0]?.id ?? '',
    date: today,
    actual_check_in: '',
    actual_check_out: '',
    status: 'PRESENT',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function pickEmployee(id: string) {
    const emp = employees.find((e) => e.id === id);
    setForm((f) => ({ ...f, employee_id: id, outlet_id: emp?.outlet_id ?? f.outlet_id }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/hr/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? 'Gagal');
      }
      qc.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Absensi tersimpan');
      setForm({ ...form, actual_check_in: '', actual_check_out: '', notes: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setSaving(false);
    }
  }

  async function clockIn(employeeId: string) {
    setSaving(true);
    try {
      const r = await fetch('/api/hr/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, outlet_id: '', date: today })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? 'Gagal clock in');
      }
      const j = await r.json().catch(() => ({}));
      if (j?.data?.already) {
        toast.info('Sudah clock in hari ini', 'Absensi hari ini sudah tercatat sebelumnya.');
      } else {
        toast.success('Clock in berhasil');
      }
      qc.invalidateQueries({ queryKey: ['attendance'] });
      router.refresh();
    } catch (e) {
      toast.error('Clock in gagal', e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  }

  async function clockOut(attendanceId: string) {
    setSaving(true);
    try {
      const r = await fetch('/api/hr/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance_id: attendanceId })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? 'Gagal clock out');
      }
      toast.success('Clock out berhasil');
      qc.invalidateQueries({ queryKey: ['attendance'] });
      router.refresh();
    } catch (e) {
      toast.error('Clock out gagal', e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...rows].sort((a, b) =>
    b.date.localeCompare(a.date) || a.employee_name.localeCompare(b.employee_name)
  );
  // Guard against malformed time values in old Sheets rows (e.g. "NaN:NaN"
  // from a bad seed) so the history never renders literal "NaN:NaN".
  const cleanTime = (v?: string) => {
    if (!v) return '-';
    if (/^NaN/i.test(v) || v === 'NaT' || !/^\d{2}:\d{2}/.test(v)) return '-';
    return v;
  };
  const statusVariant = (s: string) => {
    if (s === 'PRESENT') return 'badge-green';
    if (s === 'LATE') return 'badge-yellow';
    if (s === 'ABSENT') return 'badge-red';
    if (s === 'LEAVE' || s === 'SICK') return 'badge-gray';
    return 'badge-gray';
  };

  return (
    <div className='space-y-4'>
      <form onSubmit={submit} className='card grid gap-3'>
        <div className='grid grid-cols-2 gap-3'>
          <label className='text-sm'>
            Karyawan
            <select className='input mt-1 w-full' value={form.employee_id} onChange={(e) => pickEmployee(e.target.value)} required>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>
          <label className='text-sm'>
            Tanggal
            <input type='date' className='input mt-1 w-full' value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </label>
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <label className='text-sm'>
            Check In (HH:mm)
            <input type='time' className='input mt-1 w-full' value={form.actual_check_in} onChange={(e) => set('actual_check_in', e.target.value)} />
          </label>
          <label className='text-sm'>
            Check Out (HH:mm)
            <input type='time' className='input mt-1 w-full' value={form.actual_check_out} onChange={(e) => set('actual_check_out', e.target.value)} />
          </label>
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <label className='text-sm'>
            Status
            <select className='input mt-1 w-full' value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value='PRESENT'>PRESENT</option>
              <option value='LATE'>LATE</option>
              <option value='ABSENT'>ABSENT</option>
              <option value='LEAVE'>LEAVE</option>
              <option value='SICK'>SICK</option>
              <option value='OFF'>OFF</option>
              <option value='INCOMPLETE'>INCOMPLETE</option>
              <option value='MANUAL_CORRECTION'>MANUAL_CORRECTION</option>
            </select>
          </label>
          <label className='text-sm'>
            Catatan
            <input className='input mt-1 w-full' value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>
        {error && <div role='alert' className='rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700'>{error}</div>}
        <div>
          <button type='submit' disabled={saving} className='btn-primary'>
            {saving ? 'Menyimpan…' : 'Simpan Absensi'}
          </button>
        </div>
      </form>

      <div className='card overflow-x-auto'>
        <div className='mb-2 text-sm font-semibold'>Riwayat</div>
        {isLoading ? (
          <div className='text-sm text-muted-foreground'>Loading...</div>
        ) : sorted.length === 0 ? (
          <div className='text-sm text-muted-foreground'>Belum ada data.</div>
        ) : (
          <table className='w-full text-sm'>
            <thead className='text-left text-xs text-muted-foreground'>
              <tr>
                <th className='py-2'>Tanggal</th>
                <th>Karyawan</th>
                <th>In</th>
                <th>Out</th>
                <th>Status</th>
                <th className='text-right'>Telat (m)</th>
                <th className='text-right'>OT (m)</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.attendance_id} className='border-t border-border'>
                  <td className='py-1 font-mono text-xs'>{r.date}</td>
                  <td>{r.employee_name || r.employee_id}</td>
                  <td className='font-mono text-xs'>{cleanTime(r.actual_check_in)}</td>
                  <td className='font-mono text-xs'>{cleanTime(r.actual_check_out)}</td>
                  <td><span className={statusVariant(r.attendance_status)}>{r.attendance_status || 'PRESENT'}</span></td>
                  <td className='text-right'>{r.late_minutes || '0'}</td>
                  <td className='text-right'>{r.overtime_minutes || '0'}</td>
                  <td className='space-x-1'>
                    {!r.actual_check_in && (
                      <button className='btn-outline' type='button' onClick={() => clockIn(r.employee_id)}>Clock in</button>
                    )}
                    {r.actual_check_in && !r.actual_check_out && (
                      <button className='btn-outline' type='button' onClick={() => clockOut(r.attendance_id)}>Clock out</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}