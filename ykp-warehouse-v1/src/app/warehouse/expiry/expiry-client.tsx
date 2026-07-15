'use client';
import { useState } from 'react';

export default function ExpiryClient({
  batches, items, locations
}: {
  batches: Record<string, string>[];
  items: Record<string, string>[];
  locations: Record<string, string>[];
}) {
  const [filter, setFilter] = useState({ status: '' });
  const [list] = useState(batches);

  const filtered = list.filter((b) => {
    if (filter.status && b.status !== filter.status) return false;
    return true;
  }).sort((a, b) => (a.expiry_date || '9999').localeCompare(b.expiry_date || '9999'));

  return (
    <div className='space-y-3'>
      <div className='flex gap-2 text-xs'>
        <select value={filter.status} onChange={(e) => setFilter({ status: e.target.value })} className='rounded border border-border px-2 py-1'>
          <option value=''>All Status</option>
          {['ACTIVE','NEAR_EXPIRY','EXPIRED','DEPLETED','QUARANTINED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Batch</th><th className='px-2 py-1 text-left'>Item</th>
              <th className='px-2 py-1 text-left'>Lokasi</th><th className='px-2 py-1 text-right'>Qty</th>
              <th className='px-2 py-1 text-left'>Received</th><th className='px-2 py-1 text-left'>Expiry</th>
              <th className='px-2 py-1 text-left'>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.batch_stock_id} className={`border-t border-border ${
                b.status === 'EXPIRED' ? 'bg-red-50' : b.status === 'NEAR_EXPIRY' ? 'bg-orange-50' : ''
              }`}>
                <td className='px-2 py-1 font-mono text-[10px]'>{b.batch_number}</td>
                <td className='px-2 py-1'>{items.find((i) => i.item_id === b.item_id)?.item_name ?? b.item_id}</td>
                <td className='px-2 py-1'>{locations.find((l) => l.location_id === b.location_id)?.location_name ?? '-'}</td>
                <td className='px-2 py-1 text-right'>{b.current_qty} {b.unit}</td>
                <td className='px-2 py-1'>{b.received_date}</td>
                <td className='px-2 py-1'>{b.expiry_date || '-'}</td>
                <td className='px-2 py-1'><span className={`rounded px-1 text-[10px] font-medium ${
                  b.status === 'EXPIRED' ? 'bg-red-200 text-red-900' :
                  b.status === 'NEAR_EXPIRY' ? 'bg-orange-200 text-orange-900' :
                  b.status === 'DEPLETED' ? 'bg-gray-200 text-gray-700' :
                  'bg-green-100 text-green-800'
                }`}>{b.status}</span></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className='px-2 py-3 text-center text-muted-foreground'>Belum ada batch stock. Batch dibuat otomatis saat receiving dengan batch_number + expiry_date.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
