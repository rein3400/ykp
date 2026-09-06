'use client';
/** Brand/outlet filter + table for module detail pages. */
import { useMemo, useState } from 'react';
import type { SummaryRow } from '@/lib/types';

export interface Column {
  key: string;
  label: string;
  /** Client-side formatter id (functions cannot cross the server/client boundary). */
  format?: 'idr';
}

function formatIdr(v: string): string {
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return v || '—';
  const neg = n < 0;
  const abs = Math.round(Math.abs(n));
  return `${neg ? '-' : ''}Rp${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function FilterableRows({ rows, columns }: { rows: SummaryRow[]; columns: Column[] }) {
  const [brand, setBrand] = useState('');
  const [outlet, setOutlet] = useState('');

  const brands = useMemo(
    () => [...new Set(rows.map((r) => r.brand_name).filter(Boolean))].sort(),
    [rows]
  );
  const outlets = useMemo(
    () => [...new Set(rows.filter((r) => !brand || r.brand_name === brand).map((r) => r.outlet_name).filter(Boolean))].sort(),
    [rows, brand]
  );
  const filtered = rows.filter(
    (r) => (!brand || r.brand_name === brand) && (!outlet || r.outlet_name === outlet)
  );

  return (
    <div>
      <div className='mb-3 flex flex-wrap gap-2'>
        <select
          aria-label='Filter brand'
          value={brand}
          onChange={(e) => { setBrand(e.target.value); setOutlet(''); }}
          className='rounded border border-border bg-background px-2 py-1.5 text-xs'
        >
          <option value=''>Semua brand</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select
          aria-label='Filter outlet'
          value={outlet}
          onChange={(e) => setOutlet(e.target.value)}
          className='rounded border border-border bg-background px-2 py-1.5 text-xs'
        >
          <option value=''>Semua outlet</option>
          {outlets.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className='self-center text-[11px] text-muted-foreground'>
          {filtered.length} outlet
        </span>
      </div>
      <div className='overflow-x-auto'>
        <table className='w-full text-left text-xs'>
          <thead>
            <tr className='border-b border-border text-[10px] uppercase text-muted-foreground'>
              <th className='py-1.5 pr-3 font-medium'>Outlet</th>
              {columns.map((c) => (
                <th key={c.key} className='py-1.5 pr-3 font-medium'>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.summary_id ?? i} className='border-b border-border last:border-0'>
                <td className='py-1.5 pr-3 font-medium'>{r.outlet_name ?? '—'}</td>
                {columns.map((c) => (
                  <td key={c.key} className='py-1.5 pr-3'>
                    {c.format === 'idr' ? formatIdr(r[c.key] ?? '') : r[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className='py-4 text-center text-muted-foreground'>
                  Tidak ada data untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
