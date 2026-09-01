'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatIdr } from '@/lib/format';
import { computeTimeline } from '@/lib/employment-contract';
import { useToast } from '@/components/toast';
import { useConfirm } from '@/components/confirm-dialog';

interface Employee {
  employee_id: string;
  full_name: string;
  role: string;
  position: string;
  brand_id: string;
  outlet_id: string;
  basic_salary: string;
  salary_type: string;
  employment_status: string;
  active_status: string;
  join_date: string;
  probation_end_date: string;
  contract_start_date: string;
  contract_end_date: string;
  permanent_date: string;
}

export function EmployeesTable({
  data,
  brandById,
  outletById,
  canEdit
}: {
  data: Employee[];
  brandById: Map<string, string>;
  outletById: Map<string, string>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  async function deactivate(id: string, name: string) {
    const ok = await confirm({
      title: `Nonaktifkan ${name}?`,
      description: `Karyawan ${id} akan dinonaktifkan. Data absensi dan payroll tetap tersimpan.`,
      confirmLabel: 'Nonaktifkan',
      cancelLabel: 'Batal',
      tone: 'danger'
    });
    if (!ok) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/hr/employees/${id}/deactivate`, { method: 'POST' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? 'Gagal');
      }
      toast.success('Karyawan dinonaktifkan', name);
      router.refresh();
    } catch (e) {
      toast.error('Gagal menonaktifkan', e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...data].sort((a, b) => a.employee_id.localeCompare(b.employee_id));
  const activeBadge = (s: string) =>
    s === 'active' || s === '1' ? 'badge-green' : 'badge-gray';

  const q = query.trim().toLowerCase();
  const filtered = sorted.filter((e) => {
    if (statusFilter === 'active' && !(e.active_status === 'active' || e.active_status === '1')) return false;
    if (statusFilter === 'inactive' && (e.active_status === 'active' || e.active_status === '1')) return false;
    if (!q) return true;
    const haystack = [
      e.employee_id,
      e.full_name,
      e.role,
      e.position,
      brandById.get(e.brand_id) ?? e.brand_id,
      outletById.get(e.outlet_id) ?? e.outlet_id
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  });

  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap items-center gap-2'>
        <input
          type='search'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Cari nama / ID / role / outlet…'
          className='w-full max-w-xs rounded border border-border bg-background px-3 py-1.5 text-sm'
          aria-label='Cari karyawan'
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          className='rounded border border-border bg-background px-2 py-1.5 text-sm'
          aria-label='Filter status'
        >
          <option value='all'>Semua status</option>
          <option value='active'>Aktif</option>
          <option value='inactive'>Nonaktif</option>
        </select>
        <span className='text-xs text-muted-foreground'>
          {filtered.length} dari {sorted.length} karyawan
        </span>
      </div>
      <table className='w-full text-sm'>
        <thead className='text-left text-xs text-muted-foreground'>
          <tr>
            <th className='py-2'>Employee ID</th>
            <th>Nama</th>
            <th>Role</th>
            <th>Posisi</th>
            <th>Brand</th>
            <th>Outlet</th>
            <th className='text-right'>Gaji Pokok</th>
            <th>Tipe</th>
            <th>Status Kerja</th>
            <th>Probation</th>
            <th>Kontrak</th>
            <th>Join</th>
            {canEdit && <th className='text-right'>Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((e) => {
            const isActive = e.active_status === 'active' || e.active_status === '1';
            return (
              <tr key={e.employee_id} className='border-t border-border'>
                <td className='py-1 font-mono text-xs'>{e.employee_id}</td>
                <td>{e.full_name}</td>
                <td>{e.role || 'staff'}</td>
                <td>{e.position || '-'}</td>
                <td>{brandById.get(e.brand_id) ?? e.brand_id}</td>
                <td>{outletById.get(e.outlet_id) ?? e.outlet_id}</td>
                <td className='text-right'>{formatIdr(e.basic_salary || '0')}</td>
                <td>{e.salary_type || 'MONTHLY'}</td>
                <td>
                  <span className={activeBadge(e.active_status)}>
                    {e.employment_status || '-'}
                  </span>
                </td>
                <td className='font-mono text-xs'>
                  {(() => {
                    const tl = computeTimeline(e.join_date, e.employment_status, undefined, { probationEndDate: e.probation_end_date, contractStartDate: e.contract_start_date, contractEndDate: e.contract_end_date });
                    if (!tl || e.employment_status?.toUpperCase() === 'PERMANENT') return e.probation_end_date || tl?.probationEndDate || '-';
                    const d = tl.probationDaysRemaining;
                    return `${tl.probationEndDate} ${d >= 0 && d <= 7 ? `(${d}h)` : ''}`;
                  })()}
                </td>
                <td className='font-mono text-xs'>
                  {(() => {
                    const tl = computeTimeline(e.join_date, e.employment_status, undefined, { probationEndDate: e.probation_end_date, contractStartDate: e.contract_start_date, contractEndDate: e.contract_end_date });
                    if (!tl || e.employment_status?.toUpperCase() === 'PERMANENT') return '-';
                    const d = tl.contractDaysRemaining;
                    return `${tl.contractEndDate} ${d >= 0 && d <= 14 ? `(${d}h)` : ''}`;
                  })()}
                </td>
                <td className='font-mono text-xs'>{e.join_date}</td>
                {canEdit && (
                  <td className='space-x-1 text-right'>
                    <Link href={`/hr/employees/${e.employee_id}`} className='btn-outline'>
                      Edit
                    </Link>
                    {isActive && (
                      <button
                        type='button'
                        className='btn-ghost text-red-600'
                        disabled={busyId === e.employee_id}
                        onClick={() => deactivate(e.employee_id, e.full_name)}
                      >
                        {busyId === e.employee_id ? '…' : 'Nonaktifkan'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 14 : 13} className='py-6 text-center text-muted-foreground'>
                {q || statusFilter !== 'all'
                  ? 'Tidak ada karyawan yang cocok dengan pencarian/filter.'
                  : 'Belum ada karyawan.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}