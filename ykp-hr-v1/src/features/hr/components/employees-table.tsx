'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatIdr } from '@/lib/format';
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

  return (
    <div className='space-y-2'>
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
            <th>Status</th>
            <th>Join</th>
            {canEdit && <th className='text-right'>Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => {
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
                    {e.employment_status || e.active_status || '-'}
                  </span>
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
        </tbody>
      </table>
    </div>
  );
}