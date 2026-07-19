'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = Record<string, string>;

const SEV_CLS: Record<string, string> = {
  CRITICAL: 'bg-destructive text-destructive-foreground',
  HIGH: 'bg-warning text-white',
  MEDIUM: 'bg-primary text-primary-foreground',
  LOW: 'bg-muted text-muted-foreground'
};

export default function AlertsClient({ alerts, outlets }: { alerts: Row[]; outlets: Row[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  async function resolve(id: string) {
    setLoading(id);
    setErr(null);
    try {
      const r = await fetch(`/api/ops/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED' })
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? 'Gagal resolve'); return; }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const rows = alerts.filter((a) => !statusFilter || a.status === statusFilter);

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className='rounded border border-border px-2 py-1.5 text-xs'>
          <option value=''>Semua Status</option>
          <option value='OPEN'>OPEN</option>
          <option value='ACKNOWLEDGED'>ACKNOWLEDGED</option>
          <option value='RESOLVED'>RESOLVED</option>
        </select>
        {err && <p className='text-xs text-destructive'>{err}</p>}
      </div>
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Waktu</th>
              <th className='px-2 py-1 text-center'>Severity</th>
              <th className='px-2 py-1 text-left'>Tipe</th>
              <th className='px-2 py-1 text-left'>Outlet</th>
              <th className='px-2 py-1 text-left'>Alert</th>
              <th className='px-2 py-1 text-center'>Status</th>
              <th className='px-2 py-1'></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.alert_id} className='border-t border-border align-top'>
                <td className='px-2 py-1 whitespace-nowrap'>{a.alert_datetime}</td>
                <td className='px-2 py-1 text-center'>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${SEV_CLS[a.severity]}`}>{a.severity}</span>
                </td>
                <td className='px-2 py-1 text-muted-foreground'>{a.alert_type}</td>
                <td className='px-2 py-1'>{outlets.find((o) => o.outlet_id === a.outlet_id)?.outlet_name ?? a.outlet_id}</td>
                <td className='px-2 py-1 max-w-md'>{a.title}<p className='text-muted-foreground'>{a.action_required}</p></td>
                <td className='px-2 py-1 text-center'>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${a.status === 'OPEN' ? 'bg-destructive/10 text-destructive' : 'bg-success/20 text-success'}`}>
                    {a.status}
                  </span>
                </td>
                <td className='px-2 py-1 text-right'>
                  {a.status === 'OPEN' && (
                    <button onClick={() => resolve(a.alert_id)} disabled={loading === a.alert_id}
                      className='rounded border border-success px-2 py-0.5 text-[10px] text-success hover:bg-success/10 disabled:opacity-50'>
                      {loading === a.alert_id ? 'ΓÇª' : 'Resolve'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className='px-2 py-6 text-center text-muted-foreground'>
                Tidak ada alert. Jalankan Regenerate di halaman Summary untuk evaluasi rules.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
