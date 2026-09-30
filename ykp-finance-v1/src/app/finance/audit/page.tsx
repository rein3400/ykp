import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface AuditRow {
  audit_id?: string;
  module?: string;
  action?: string;
  record_type?: string;
  record_id?: string;
  before_value?: string;
  after_value?: string;
  reason?: string;
  user_id?: string;
  approval_user_id?: string;
  environment?: string;
  ip_address?: string;
  created_at?: string;
  chain_hash?: string;
}

function trim(s: string | undefined, n: number): string {
  const v = (s ?? '').replace(/\s+/g, ' ').trim();
  return v.length > n ? v.slice(0, n) + '…' : v;
}

const ACTION_TONE: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-800',
  update: 'bg-sky-100 text-sky-800',
  delete: 'bg-red-100 text-red-800',
  approve: 'bg-emerald-100 text-emerald-800',
  reject: 'bg-red-100 text-red-800',
  request_revision: 'bg-amber-100 text-amber-800'
};

export default async function FinanceAuditPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role as Role, 'view', 'audit')) redirect('/finance');

  const rows = (await readTab<AuditRow>(TABS.auditLog)).slice().reverse();

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Audit Trail</h1>
        <p className='text-sm text-muted-foreground'>
          Riwayat aktivitas Finance (read-only): perubahan data dengan nilai sebelum/sesudah, permintaan revisi payroll
          + alasan, notifikasi transfer, dan aksi sensitif lain. Tidak ada tombol ubah/hapus di halaman ini.
        </p>
      </div>

      <div className='overflow-x-auto rounded-xl border bg-card'>
        <table className='w-full text-left text-xs'>
          <thead className='border-b bg-muted text-muted-foreground'>
            <tr>
              <th className='px-3 py-2'>Waktu</th>
              <th className='px-3 py-2'>User</th>
              <th className='px-3 py-2'>Aksi</th>
              <th className='px-3 py-2'>Record</th>
              <th className='px-3 py-2'>Alasan</th>
              <th className='px-3 py-2'>Sebelum</th>
              <th className='px-3 py-2'>Sesudah</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className='px-3 py-6 text-center text-muted-foreground'>
                  Belum ada riwayat audit.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.audit_id || String(i)} className='border-b align-top last:border-0'>
                  <td className='whitespace-nowrap px-3 py-2 font-mono text-[11px]'>{r.created_at || '-'}</td>
                  <td className='whitespace-nowrap px-3 py-2'>
                    {r.user_id || '-'}
                    <span className='ml-1 text-[10px] text-muted-foreground'>({r.environment || '-'})</span>
                  </td>
                  <td className='whitespace-nowrap px-3 py-2'>
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${ACTION_TONE[r.action ?? ''] ?? 'bg-muted text-foreground'}`}>
                      {r.action}
                    </span>
                  </td>
                  <td className='whitespace-nowrap px-3 py-2'>
                    {r.record_type}
                    {r.record_id ? <span className='ml-1 font-mono text-[10px] text-muted-foreground'>{r.record_id}</span> : null}
                  </td>
                  <td className='px-3 py-2'>{trim(r.reason, 60) || '-'}</td>
                  <td className='px-3 py-2 font-mono text-[10px] text-muted-foreground'>{trim(r.before_value, 60) || '-'}</td>
                  <td className='px-3 py-2 font-mono text-[10px] text-muted-foreground'>{trim(r.after_value, 60) || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className='text-[11px] text-muted-foreground'>
        Menampilkan {rows.length} entri (sumber: tab audit_log, read-only).
      </p>
    </div>
  );
}
