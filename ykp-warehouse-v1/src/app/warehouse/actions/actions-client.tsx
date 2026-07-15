'use client';
import { useState } from 'react';

export default function ActionsClient({
  actions, items
}: {
  actions: Record<string, string>[];
  items: Record<string, string>[];
}) {
  const [filter, setFilter] = useState({ status: '' });
  const [list, setList] = useState(actions);

  const filtered = list.filter((a) => {
    if (filter.status && a.status !== filter.status) return false;
    return true;
  }).sort((a, b) => {
    if (a.status === 'OVERDUE' && b.status !== 'OVERDUE') return -1;
    if (b.status === 'OVERDUE' && a.status !== 'OVERDUE') return 1;
    return (a.due_date || '').localeCompare(b.due_date || '');
  });

  async function updateStatus(actionId: string, status: string) {
    await fetch('/api/warehouse/actions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action_id: actionId, status }) });
    const r = await fetch('/api/warehouse/actions');
    const j = await r.json();
    if (j.data?.items) setList(j.data.items);
  }

  return (
    <div className='space-y-3'>
      <div className='flex gap-2 text-xs'>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className='rounded border border-border px-2 py-1'>
          <option value=''>All Status</option>
          {['OPEN','IN_PROGRESS','WAITING_APPROVAL','DONE','CANCELLED','OVERDUE'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Title</th><th className='px-2 py-1 text-left'>Item</th>
              <th className='px-2 py-1 text-left'>Priority</th><th className='px-2 py-1 text-left'>Assigned</th>
              <th className='px-2 py-1 text-left'>Due</th><th className='px-2 py-1 text-left'>Status</th>
              <th className='px-2 py-1 text-left'>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.action_id} className={`border-t border-border ${a.status === 'OVERDUE' ? 'bg-red-50' : ''}`}>
                <td className='px-2 py-1 font-medium'>{a.title}</td>
                <td className='px-2 py-1'>{items.find((i) => i.item_id === a.item_id)?.item_name ?? '-'}</td>
                <td className='px-2 py-1'>{a.priority}</td>
                <td className='px-2 py-1'>{a.assigned_to || a.assigned_role || '-'}</td>
                <td className='px-2 py-1'>{a.due_date || '-'}</td>
                <td className='px-2 py-1'><span className={`rounded px-1 text-[10px] font-medium ${
                  a.status === 'OVERDUE' ? 'bg-red-200 text-red-900' :
                  a.status === 'DONE' ? 'bg-green-200 text-green-900' :
                  a.status === 'IN_PROGRESS' ? 'bg-blue-200 text-blue-900' :
                  'bg-gray-200 text-gray-700'
                }`}>{a.status}</span></td>
                <td className='px-2 py-1'>
                  {a.status !== 'DONE' && a.status !== 'CANCELLED' && (
                    <div className='flex gap-1'>
                      <button onClick={() => updateStatus(a.action_id, 'IN_PROGRESS')} className='rounded bg-blue-500 px-1.5 py-0.5 text-[10px] text-white'>Start</button>
                      <button onClick={() => updateStatus(a.action_id, 'DONE')} className='rounded bg-green-500 px-1.5 py-0.5 text-[10px] text-white'>Done</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className='px-2 py-3 text-center text-muted-foreground'>No actions. Auto-created from HIGH/CRITICAL alerts.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
