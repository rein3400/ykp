import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, Role } from '@/lib/rbac';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface AuditRow {
  audit_id?: string;
  timestamp?: string;
  actor_user_id?: string;
  actor_role?: string;
  action?: string;
  entity?: string;
  entity_id?: string;
  before_value?: string;
  after_value?: string;
  reason?: string;
  module?: string;
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
  generate: 'bg-indigo-100 text-indigo-800'
};

export default async function AuditPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role as Role, 'view', 'audit')) redirect('/hr');

  const rows = (await readTab<AuditRow>(TABS.auditLog)).slice().reverse();

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Audit Trail</h1>
        <p className='text-sm text-slate-500'>
          Riwayat lengkap (read-only): perubahan karyawan (nilai sebelum/sesudah), generate payroll, revisi + alasan,
          notifikasi transfer, dan validasi pembayaran. Tidak ada aksi ubah/hapus di halaman ini.
        </p>
      </div>

      <div className='overflow-x-auto rounded-xl border bg-white'>
        <table className='w-full text-left text-xs'>
          <thead className='border-b bg-slate-50 text-slate-500'>
            <tr>
              <th className='px-3 py-2'>Waktu</th>
              <th className='px-3 py-2'>Aktor</th>
              <th className='px-3 py-2'>Aksi</th>
              <th className='px-3 py-2'>Entitas</th>
              <th className='px-3 py-2'>Sumber</th>
              <th className='px-3 py-2'>Alasan</th>
              <th className='px-3 py-2'>Sebelum</th>
              <th className='px-3 py-2'>Sesudah</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className='px-3 py-6 text-center text-slate-500'>
                  Belum ada riwayat audit.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.audit_id || String(i)} className='border-b last:border-0 align-top'>
                  <td className='whitespace-nowrap px-3 py-2 font-mono text-[11px]'>{r.timestamp || r.module || '-'}</td>
                  <td className='whitespace-nowrap px-3 py-2'>
                    {r.actor_user_id}
                    <span className='ml-1 text-[10px] text-slate-500'>({r.actor_role})</span>
                  </td>
                  <td className='whitespace-nowrap px-3 py-2'>
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${ACTION_TONE[r.action ?? ''] ?? 'bg-slate-100 text-slate-700'}`}>
                      {r.action}
                    </span>
                  </td>
                  <td className='whitespace-nowrap px-3 py-2'>
                    {r.entity}
                    {r.entity_id ? <span className='ml-1 font-mono text-[10px] text-slate-500'>{r.entity_id}</span> : null}
                  </td>
                  <td className='px-3 py-2'>{r.module || '-'}</td>
                  <td className='px-3 py-2'>{trim(r.reason, 60) || '-'}</td>
                  <td className='px-3 py-2 font-mono text-[10px] text-slate-600'>{trim(r.before_value, 60) || '-'}</td>
                  <td className='px-3 py-2 font-mono text-[10px] text-slate-600'>{trim(r.after_value, 60) || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className='text-[11px] text-slate-400'>
        Menampilkan {rows.length} entri terbaru pertama (sumber: tab hr_audit_log, read-only).
      </p>
    </div>
  );
}
