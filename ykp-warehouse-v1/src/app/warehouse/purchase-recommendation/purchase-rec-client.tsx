'use client';
import { useState } from 'react';

export default function PurchaseRecClient({
  recommendations
}: {
  recommendations: Record<string, string>[];
}) {
  const [list, setList] = useState(recommendations);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function regenerate() {
    setLoading(true); setErr(null);
    const r = await fetch('/api/warehouse/purchase-recommendation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList(j.data?.recommendations ?? []);
  }

  const sorted = [...list].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.priority as keyof typeof order] ?? 9) - (order[b.priority as keyof typeof order] ?? 9);
  });

  return (
    <div className='space-y-3'>
      <button onClick={regenerate} disabled={loading} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50'>
        {loading ? 'Generating…' : 'Generate Recommendations'}
      </button>
      {err && <p className='text-xs text-destructive'>{err}</p>}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Priority</th><th className='px-2 py-1 text-left'>Item</th>
              <th className='px-2 py-1 text-right'>Available</th><th className='px-2 py-1 text-right'>Days Cover</th>
              <th className='px-2 py-1 text-right'>Reorder</th><th className='px-2 py-1 text-right'>Suggested</th>
              <th className='px-2 py-1 text-right'>Est. Value</th><th className='px-2 py-1 text-left'>Supplier</th>
              <th className='px-2 py-1 text-left'>Reason</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.recommendation_id} className={`border-t border-border ${
                r.priority === 'CRITICAL' ? 'bg-red-50' : r.priority === 'HIGH' ? 'bg-orange-50' : ''
              }`}>
                <td className='px-2 py-1'><span className={`rounded px-1 text-[10px] font-medium ${
                  r.priority === 'CRITICAL' ? 'bg-red-200 text-red-900' :
                  r.priority === 'HIGH' ? 'bg-orange-200 text-orange-900' :
                  r.priority === 'MEDIUM' ? 'bg-yellow-200 text-yellow-900' :
                  'bg-gray-200 text-gray-700'
                }`}>{r.priority}</span></td>
                <td className='px-2 py-1 font-medium'>{r.item_name}</td>
                <td className='px-2 py-1 text-right'>{formatQty(r.available_stock)}</td>
                <td className='px-2 py-1 text-right'>{formatQty(r.days_of_cover)}</td>
                <td className='px-2 py-1 text-right'>{formatQty(r.reorder_point)}</td>
                <td className='px-2 py-1 text-right font-medium'>{formatQty(r.rounded_purchase_qty)} {r.purchase_unit}</td>
                <td className='px-2 py-1 text-right'>{formatRp(r.estimated_purchase_value)}</td>
                <td className='px-2 py-1'>{r.supplier_name || '-'}</td>
                <td className='px-2 py-1 text-muted-foreground text-[10px]'>{r.reason}</td>
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={9} className='px-2 py-3 text-center text-muted-foreground'>Belum ada recommendation. Klik Generate. Pastikan master item, average usage, lead time, stock opening terisi.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatRp(n: string) {
  const v = Number(n || 0);
  if (!v) return '-';
  return new Intl.NumberFormat('id-ID').format(Math.round(v));
}

/**
 * Clean float noise for stock/qty display (4.69999999999999 → 4,7).
 * Also handles id-ID / en-US thousand separators already baked into sheet cells.
 */
function formatQty(n: string) {
  if (n === 'N/A' || n == null || n === '') return n || '-';
  const s = String(n).trim();
  let normalized = s;
  if (s.includes(',') && s.includes('.')) {
    // 1.234,56 → 1234.56
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    // 4.699.999.999.999.990 → treat last group as decimals if 3 digits, else integer groups
    const parts = s.split('.');
    const last = parts[parts.length - 1] ?? '';
    if (last.length === 3 && parts.length > 2) {
      // all thousand groups (no decimals): 4.699.999 → 4699999
      normalized = parts.join('');
    } else {
      const dec = parts.pop();
      normalized = parts.join('') + '.' + dec;
    }
  } else if (s.includes(',')) {
    normalized = s.replace(',', '.');
  }
  const v = Number(normalized);
  if (!Number.isFinite(v)) return s;
  // Clamp absurd stock (float/seed corruption) — never show trillions of kg.
  if (Math.abs(v) > 1_000_000) {
    // Likely float artifact of a small qty written with thousands formatting;
    // try recovering a plausible 0–9999 value from the fractional pattern.
    const frac = Math.abs(v);
    if (frac > 1e9) return '—';
  }
  const rounded = Math.round((v + Number.EPSILON) * 1000) / 1000;
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(rounded);
}
