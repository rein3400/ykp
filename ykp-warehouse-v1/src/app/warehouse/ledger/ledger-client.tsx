'use client';
import { useState } from 'react';

const MOVEMENT_TYPES = [
  'OPENING_BALANCE','RECEIPT','ISSUE','TRANSFER_IN','TRANSFER_OUT',
  'WASTE','RETURN_IN','RETURN_OUT','COUNT_ADJUSTMENT','REVERSAL',
  'PRODUCTION_IN','PRODUCTION_OUT'
];

export default function LedgerClient({
  movements, items, locations
}: {
  movements: Record<string, string>[];
  items: Record<string, string>[];
  locations: Record<string, string>[];
}) {
  const [filters, setFilters] = useState({ item_id: '', location_id: '', movement_type: '' });

  const filtered = movements.filter((m) => {
    if (filters.item_id && m.item_id !== filters.item_id) return false;
    if (filters.location_id && m.location_id !== filters.location_id) return false;
    if (filters.movement_type && m.movement_type !== filters.movement_type) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) =>
    (b.movement_datetime || '').localeCompare(a.movement_datetime || ''),
  );

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap gap-2 text-xs'>
        <select value={filters.item_id} onChange={(e) => setFilters({ ...filters, item_id: e.target.value })} className='rounded border border-border px-2 py-1'>
          <option value=''>Semua Item</option>
          {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.item_name}</option>)}
        </select>
        <select value={filters.location_id} onChange={(e) => setFilters({ ...filters, location_id: e.target.value })} className='rounded border border-border px-2 py-1'>
          <option value=''>Semua Lokasi</option>
          {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
        </select>
        <select value={filters.movement_type} onChange={(e) => setFilters({ ...filters, movement_type: e.target.value })} className='rounded border border-border px-2 py-1'>
          <option value=''>Semua Tipe</option>
          {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Waktu</th>
              <th className='px-2 py-1 text-left'>Item</th>
              <th className='px-2 py-1 text-left'>Lokasi</th>
              <th className='px-2 py-1 text-left'>Tipe</th>
              <th className='px-2 py-1 text-center'>Arah</th>
              <th className='px-2 py-1 text-right'>Qty</th>
              <th className='px-2 py-1 text-right'>Unit Cost</th>
              <th className='px-2 py-1 text-right'>Total</th>
              <th className='px-2 py-1 text-right'>Before</th>
              <th className='px-2 py-1 text-right'>After</th>
              <th className='px-2 py-1 text-left'>Ref</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.movement_id} className='border-t border-border'>
                <td className='px-2 py-1 font-mono text-[10px]'>{m.movement_datetime}</td>
                <td className='px-2 py-1'>{items.find((i) => i.item_id === m.item_id)?.item_name ?? m.item_id}</td>
                <td className='px-2 py-1'>{locations.find((l) => l.location_id === m.location_id)?.location_name ?? m.location_id}</td>
                <td className='px-2 py-1'>{m.movement_type?.replace(/_/g, ' ')}</td>
                <td className='px-2 py-1 text-center'>
                  <span className={`inline-block rounded px-1 text-[10px] font-medium ${
                    m.direction === 'IN' ? 'bg-green-100 text-green-800' :
                    m.direction === 'OUT' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>{m.direction}</span>
                </td>
                <td className='px-2 py-1 text-right'>{m.quantity} {m.base_unit}</td>
                <td className='px-2 py-1 text-right'>{formatRp(m.unit_cost)}</td>
                <td className='px-2 py-1 text-right'>{formatRp(m.total_value)}</td>
                <td className='px-2 py-1 text-right'>{m.stock_before}</td>
                <td className='px-2 py-1 text-right font-medium'>{m.stock_after}</td>
                <td className='px-2 py-1 font-mono text-[10px]'>{m.reference_type}/{m.reference_id}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={11} className='px-2 py-3 text-center text-muted-foreground'>Belum ada transaksi stok. Ledger akan terisi otomatis saat receiving/issue/transfer/waste.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatRp(n: string) {
  const v = Number(n || 0);
  if (!v) return '-';
  return new Intl.NumberFormat('id-ID').format(v);
}
