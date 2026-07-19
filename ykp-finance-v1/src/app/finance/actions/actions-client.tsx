'use client';
/**
 * Action Tracker (Revisi #22) — alert tanpa action hanya notifikasi.
 * HIGH/CRITICAL alerts auto-create rows di sini saat regenerate.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { todayWib } from '@/lib/wib';
import { can, type Role } from '@/lib/rbac';
import { Card, EmptyState, Btn, Th, Td, Badge, Select } from '../ui';

const NEXT: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['DONE', 'WAITING_APPROVAL', 'CANCELLED'],
  WAITING_APPROVAL: ['DONE', 'IN_PROGRESS'],
  OVERDUE: ['IN_PROGRESS', 'DONE', 'CANCELLED'],
  DONE: [],
  CANCELLED: []
};

export default function ActionsClient({ actions, role }: { actions: Record<string, string>[]; role: string }) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const canUpdate = can(role as Role, 'update', 'action');
  const today = todayWib();

  const rows = useMemo(() => actions
    .filter((a) => (!status || a.status === status))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
  [actions, status]);

  async function update(id: string, s: string) {
    try {
      const r = await fetch(`/api/finance/actions/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: s })
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal'); return; }
      toast.success(`Action → ${s}`);
      router.refresh();
    } catch { toast.error('Network error'); }
  }

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Action Tracker</h1>
        <p className='text-sm text-muted-foreground'>Tindak lanjut alert HIGH/CRITICAL dengan PIC dan deadline.</p>
      </div>

      <div className='flex gap-2 rounded border border-border bg-background p-2'>
        <div className='w-48'>
          <Select label='Status' value={status} onChange={setStatus}>
            <option value=''>Semua</option>
            {['OPEN', 'IN_PROGRESS', 'WAITING_APPROVAL', 'DONE', 'CANCELLED', 'OVERDUE'].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState message={'Belum ada action.\nAction dibuat otomatis dari alert HIGH/CRITICAL saat regenerate laporan harian.'} />
      ) : (
        <Card title={`Actions (${rows.length})`}>
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead className='bg-muted text-muted-foreground'>
                <tr>
                  <Th>Judul</Th><Th>Outlet</Th><Th>Priority</Th><Th>PIC</Th>
                  <Th>Deadline</Th><Th>Status</Th><Th>Source Alert</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const overdue = a.due_date && a.due_date < today && !['DONE', 'CANCELLED'].includes(a.status);
                  return (
                    <tr key={a.action_id} className='border-t border-border'>
                      <Td bold>{a.title}</Td>
                      <Td>{a.outlet}</Td>
                      <Td><Badge value={a.priority} /></Td>
                      <Td muted>{a.assigned_to}</Td>
                      <Td>
                        <span className={overdue ? 'font-medium text-red-700' : 'text-muted-foreground'}>
                          {a.due_date}{overdue ? ' (overdue)' : ''}
                        </span>
                      </Td>
                      <Td><Badge value={a.status} /></Td>
                      <Td muted>{a.source_alert_id}</Td>
                      <Td>
                        {canUpdate && (NEXT[a.status] ?? []).length > 0 && (
                          <div className='flex gap-1'>
                            {(NEXT[a.status] ?? []).map((s) => (
                              <Btn key={s} variant='ghost' onClick={() => update(a.action_id, s)}>{s.replace('_', ' ').toLowerCase()}</Btn>
                            ))}
                          </div>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
