'use client';
import { useState } from 'react';

type Row = Record<string, string>;

export default function SummaryClient({ summaries }: { summaries: Row[] }) {
  const [list, setList] = useState(summaries);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function regenerate() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch('/api/ops/summary/regenerate', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? 'Gagal regenerate'); return; }
      const d = j.data;
      setMsg(`${d.summaries_upserted} summary dibuat/diupdate ┬╖ ${d.alerts_created} alert baru ┬╖ ${d.actions_created} action baru`);
      const get = await fetch('/api/ops/summary').then((x) => x.json());
      setList(get.data?.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <button onClick={regenerate} disabled={loading} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50'>
          {loading ? 'MemprosesΓÇª' : 'Regenerate Hari Ini'}
        </button>
        {msg && <p className='text-xs text-success'>{msg}</p>}
        {err && <p className='text-xs text-destructive'>{err}</p>}
      </div>

      <div className='space-y-3'>
        {list.map((s) => (
          <div key={s.summary_id} className='rounded border border-border p-3'>
            <div className='mb-2 flex items-center justify-between'>
              <p className='text-sm font-bold'>{s.brand_name} ΓÇö {s.outlet_name} ┬╖ {s.date}</p>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                s.opening_status === 'READY' ? 'bg-success text-white'
                : s.opening_status === 'FAILED' ? 'bg-destructive text-destructive-foreground'
                : s.opening_status === 'CONDITIONAL' ? 'bg-warning text-white'
                : 'bg-muted text-muted-foreground'
              }`}>{s.opening_status}</span>
            </div>
            <div className='grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-4'>
              <Kpi label='Opening Completion' value={`${s.opening_completion_percentage}%`} />
              <Kpi label='Critical Opening Issue' value={s.critical_opening_issue} bad={Number(s.critical_opening_issue) > 0} />
              <Kpi label='Incident' value={`${s.incident_count} (HIGH/CRIT: ${s.high_severity_incident})`} bad={Number(s.high_severity_incident) > 0} />
              <Kpi label='Complaint' value={s.complaint_count} />
              <Kpi label='Waste' value={`${s.waste_qty} pcs ┬╖ ${rp(s.waste_value)}`} />
              <Kpi label='Closing' value={s.closing_status} bad={s.closing_status === 'MISSING'} />
              <Kpi label='Cash Difference' value={rp(s.cash_difference)} bad={Math.abs(Number(s.cash_difference)) > 50000} />
              <Kpi label='Open Actions' value={s.open_action_count} bad={Number(s.open_action_count) > 0} />
            </div>
            {s.major_ops_issue && (
              <div className='mt-2 rounded bg-destructive/5 p-2 text-xs'>
                <b>Issue:</b> {s.major_ops_issue}
              </div>
            )}
            {s.recommended_action && (
              <div className='mt-1 rounded bg-muted/50 p-2 text-xs'>
                <b>Action:</b> {s.recommended_action}
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && (
          <div className='rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>
            Belum ada summary. Klik &quot;Regenerate Hari Ini&quot;.
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className='flex justify-between gap-2'>
      <span className='text-muted-foreground'>{label}</span>
      <b className={bad ? 'text-destructive' : ''}>{value}</b>
    </div>
  );
}

function rp(n: string) {
  const v = Number(n || 0);
  const sign = v < 0 ? '-' : '';
  return `${sign}Rp ${Math.abs(v).toLocaleString('id-ID')}`;
}
