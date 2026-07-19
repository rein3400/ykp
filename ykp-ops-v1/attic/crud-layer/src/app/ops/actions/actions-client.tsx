'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = Record<string, string>;

const PRI_CLS: Record<string, string> = {
  CRITICAL: 'bg-destructive text-destructive-foreground',
  HIGH: 'bg-warning text-white',
  MEDIUM: 'bg-primary text-primary-foreground',
  LOW: 'bg-muted text-muted-foreground'
};

export default function ActionsClient({ actions, outlets, today }: { actions: Row[]; outlets: Row[]; today: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  async function patch(id: string, body: Record<string, string>) {
    setLoading(id);
    setErr(null);
    try {
      const r = await fetch(`/api/ops/actions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? 'Gagal update'); return; }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const rows = actions.filter((a) => !filter || a.status === filter);

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className='rounded border border-border px-2 py-1.5 text-xs'>
          <option value=''>Semua Status</option>
          <option value='OPEN'>OPEN</option>
          <option value='IN_PROGRESS'>IN_PROGRESS</option>
          <option value='DONE'>DONE</option>
          <option value='CANCELLED'>CANCELLED</option>
        </select>
        {err && <p className='text-xs text-destructive'>{err}</p>}
      </div>
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-center'>Prioritas</th>
              <th className='px-2 py-1 text-left'>Action</th>
              <th className='px-2 py-1 text-left'>Outlet</th>
              <th className='px-2 py-1 text-left'>PIC</th>
              <th className='px-2 py-1 text-left'>Deadline</th>
              <th className='px-2 py-1 text-center'>Status</th>
              <th className='px-2 py-1 text-left'>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const overdue = a.due_date && a.due_date < today && (a.status === 'OPEN' || a.status === 'IN_PROGRESS');
              return (
                <tr key={a.action_id} className='border-t border-border align-top'>
                  <td className='px-2 py-1 text-center'>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PRI_CLS[a.priority] ?? PRI_CLS.MEDIUM}`}>{a.priority}</span>
                  </td>
                  <td className='px-2 py-1 max-w-md'>{a.title}<p className='text-muted-foreground'>{a.description}</p></td>
                  <td className='px-2 py-1'>{outlets.find((o) => o.outlet_id === a.outlet_id)?.outlet_name ?? a.outlet_id}</td>
                  <td className='px-2 py-1'>
                    <input
                      defaultValue={a.assigned_to}
                      placeholder='assign PIC'
                      onBlur={(e) => { if (e.target.value !== a.assigned_to) patch(a.action_id, { assigned_to: e.target.value }); }}
                      className='w-28 rounded border border-border px-1.5 py-0.5 text-xs'
                    />
                  </td>
                  <td className={`px-2 py-1 whitespace-nowrap ${overdue ? 'font-bold text-destructive' : ''}`}>
                    {a.due_date || 'ΓÇö'}{overdue ? ' (OVERDUE)' : ''}
                  </td>
                  <td className='px-2 py-1 text-center'>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      a.status === 'DONE' ? 'bg-success text-white'
                      : a.status === 'OPEN' ? 'bg-destructive/10 text-destructive'
                      : 'bg-warning/20 text-warning'
                    }`}>{a.status}</span>
                  </td>
                  <td className='px-2 py-1'>
                    <div className='flex gap-1'>
                      {a.status === 'OPEN' && (
                        <button onClick={() => patch(a.action_id, { status: 'IN_PROGRESS' })} disabled={loading === a.action_id}
                          className='rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted disabled:opacity-50'>Proses</button>
                      )}
                      {(a.status === 'OPEN' || a.status === 'IN_PROGRESS') && (
                        <button onClick={() => patch(a.action_id, { status: 'DONE' })} disabled={loading === a.action_id}
                          className='rounded border border-success px-1.5 py-0.5 text-[10px] text-success hover:bg-success/10 disabled:opacity-50'>Done</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className='px-2 py-6 text-center text-muted-foreground'>
                Tidak ada action item. Action dibuat otomatis dari alert HIGH/CRITICAL.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
