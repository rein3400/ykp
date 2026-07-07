import { readTab, TABS } from '@/db/sheets';
import { LeaveForm } from '@/features/hr/components/leave-form';

export const dynamic = 'force-dynamic';

interface Leave {
  leave_id: string;
  employee_id: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: string;
  reason: string;
  approval_status: string;
  approved_by: string;
  submitted_at: string;
}

export default async function LeavesPage() {
  const [employees, leaves] = await Promise.all([
    readTab<{ employee_id: string; full_name: string; active_status: string }>(TABS.employees),
    readTab<Leave>(TABS.leaves)
  ]);
  const activeEmployees = employees
    .filter((e) => e.active_status === 'active' || e.active_status === '1')
    .map((e) => ({ id: e.employee_id, name: e.full_name }));

  return (
    <div className='space-y-4'>
      <div className='grid gap-4 lg:grid-cols-3'>
        <div className='card lg:col-span-1'>
          <h2 className='mb-2 font-semibold'>Ajukan Izin / Cuti</h2>
          <LeaveForm employees={activeEmployees} />
        </div>
        <div className='card lg:col-span-2'>
          <h2 className='mb-2 font-semibold'>Daftar Pengajuan</h2>
          {leaves.length === 0 ? (
            <div className='text-sm text-muted-foreground'>Belum ada pengajuan.</div>
          ) : (
            <table className='w-full text-sm'>
              <thead className='text-left text-xs text-muted-foreground'>
                <tr>
                  <th className='py-2'>Karyawan</th>
                  <th>Tipe</th>
                  <th>Mulai</th>
                  <th>Selesai</th>
                  <th>Hari</th>
                  <th>Alasan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.leave_id} className='border-t border-border'>
                    <td className='py-1'>{l.employee_name || l.employee_id}</td>
                    <td>{l.leave_type}</td>
                    <td className='font-mono text-xs'>{l.start_date}</td>
                    <td className='font-mono text-xs'>{l.end_date}</td>
                    <td>{l.total_days}</td>
                    <td className='max-w-xs truncate'>{l.reason}</td>
                    <td>
                      <span className={
                        l.approval_status === 'APPROVED' ? 'badge-green' :
                        l.approval_status === 'REJECTED' ? 'badge-red' :
                        l.approval_status === 'PENDING' ? 'badge-yellow' : 'badge-gray'
                      }>{l.approval_status || 'DRAFT'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}