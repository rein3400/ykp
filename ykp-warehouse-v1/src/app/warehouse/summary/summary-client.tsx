'use client';
import { useState } from 'react';

export default function SummaryClient({ summaries }: { summaries: Record<string, string>[] }) {
  const [list, setList] = useState(summaries);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function regenerate() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/warehouse/summary/regenerate', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
      // refresh
      const get = await fetch('/api/warehouse/summary').then((x) => x.json());
      setList(get.data?.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='space-y-3'>
      <button onClick={regenerate} disabled={loading} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50'>
        {loading ? 'Memproses…' : 'Regenerate Hari Ini'}
      </button>
      {err && <p className='text-xs text-destructive'>{err}</p>}
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Tanggal</th>
              <th className='px-2 py-1 text-right'>Item Tracked</th>
              <th className='px-2 py-1 text-right'>Di Bawah Min</th>
              <th className='px-2 py-1 text-right'>Waste Count</th>
              <th className='px-2 py-1 text-right'>Waste Value</th>
              <th className='px-2 py-1 text-center'>Closing?</th>
              <th className='px-2 py-1 text-right'>Selisih &gt; Tol</th>
              <th className='px-2 py-1 text-left'>Major Issue</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.summary_id} className='border-t border-border'>
                <td className='px-2 py-1'>{s.date}</td>
                <td className='px-2 py-1 text-right'>{s.items_tracked}</td>
                <td className='px-2 py-1 text-right'>{s.items_below_min}</td>
                <td className='px-2 py-1 text-right'>{s.waste_count}</td>
                <td className='px-2 py-1 text-right'>{formatRp(s.waste_value)}</td>
                <td className='px-2 py-1 text-center'>{s.closing_done}</td>
                <td className='px-2 py-1 text-right'>{s.items_diff_gt_tolerance}</td>
                <td className='px-2 py-1 text-muted-foreground'>{s.major_warehouse_issue}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} className='px-2 py-3 text-center text-muted-foreground'>Belum ada summary. Klik Regenerate.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatRp(n: string) {
  const v = Number(n || 0);
  if (!v) return 'Rp 0';
  return new Intl.NumberFormat('id-ID').format(Math.trunc(v));
}