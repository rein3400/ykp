'use client';
import { useState } from 'react';

export default function AlertsClient({
  alerts, items
}: {
  alerts: Record<string, string>[];
  items: Record<string, string>[];
}) {
  const [filter, setFilter] = useState({ severity: '', status: '' });
  const [list, setList] = useState(alerts);

  const filtered = list.filter((a) => {
    if (filter.severity && a.severity !== filter.severity) return false;
    if (filter.status && a.status !== filter.status) return false;
    return true;
  }).sort((a, b) => b.alert_datetime.localeCompare(a.alert_datetime));

  async function updateStatus(alertId: string, action: string) {
    await fetch('/api/warehouse/alerts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alert_id: alertId, action }) });
    const r = await fetch('/api/warehouse/alerts');
    const j = await r.json();
    if (j.data?.items) setList(j.data.items);
  }

  return (
    <div className='space-y-3'>
      <div className='flex gap-2 text-xs'>
        <select value={filter.severity} onChange={(e) => setFilter({ ...filter, severity: e.target.value })} className='rounded border border-border px-2 py-1'>
          <option value=''>All Severity</option>
          {['INFO','LOW','MEDIUM','HIGH','CRITICAL'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className='rounded border border-border px-2 py-1'>
          <option value=''>All Status</option>
          {['OPEN','ACKNOWLEDGED','IN_PROGRESS','RESOLVED','CLOSED','IGNORED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className='space-y-2'>
        {filtered.map((a) => (
          <div key={a.alert_id} className={`rounded border p-3 text-xs ${
            a.severity === 'CRITICAL' ? 'border-red-400 bg-red-50' :
            a.severity === 'HIGH' ? 'border-orange-300 bg-orange-50' :
            a.severity === 'MEDIUM' ? 'border-yellow-300 bg-yellow-50' :
            'border-border bg-background'
          }`}>
            <div className='flex items-center justify-between'>
              <div>
                <span className='font-medium'>{a.alert_type?.replace(/_/g, ' ')}</span>
                <span className={`ml-2 rounded px-1 text-[10px] font-medium ${
                  a.severity === 'CRITICAL' ? 'bg-red-200 text-red-900' :
                  a.severity === 'HIGH' ? 'bg-orange-200 text-orange-900' :
                  'bg-gray-200 text-gray-700'
                }`}>{a.severity}</span>
                <span className='ml-2 text-muted-foreground'>{a.alert_datetime}</span>
              </div>
              <div className='flex gap-1'>
                {a.status === 'OPEN' && (
                  <>
                    <button onClick={() => updateStatus(a.alert_id, 'acknowledge')} className='rounded bg-blue-500 px-2 py-0.5 text-[10px] text-white'>ACK</button>
                    <button onClick={() => updateStatus(a.alert_id, 'resolve')} className='rounded bg-green-500 px-2 py-0.5 text-[10px] text-white'>Resolve</button>
                    <button onClick={() => updateStatus(a.alert_id, 'ignore')} className='rounded bg-gray-400 px-2 py-0.5 text-[10px] text-white'>Ignore</button>
                  </>
                )}
                {a.status !== 'OPEN' && <span className='text-muted-foreground'>{a.status}</span>}
              </div>
            </div>
            <p className='mt-1 font-medium'>{a.title}</p>
            <p className='text-muted-foreground'>{a.message}</p>
            {a.action_required && <p className='mt-1 text-primary font-medium'>Action: {a.action_required}</p>}
          </div>
        ))}
        {filtered.length === 0 && <p className='text-center text-muted-foreground py-4'>No alerts. System akan generate otomatis dari transaksi.</p>}
      </div>
    </div>
  );
}
