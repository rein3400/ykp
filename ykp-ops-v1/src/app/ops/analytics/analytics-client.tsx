'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AnalyticsPageClient({
  summaries,
  incidents,
  waste,
  kds,
}: {
  summaries: Record<string, string>[];
  incidents: Record<string, string>[];
  waste: Record<string, string>[];
  kds: Record<string, string>[];
}) {
  const router = useRouter();
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiInsights, setAiInsights] = useState<Record<string, string>>({});
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});

  const high = incidents.filter((r) => (r.severity === 'HIGH' || r.severity === 'CRITICAL') && r.status !== 'DONE').length;
  const wasteValue = waste.reduce((s, r) => s + Number(r.estimated_total_value || 0), 0);
  const overSla = kds.filter((r) => r.sla_status === 'OVER_SLA' || r.sla_status === 'CRITICAL_DELAY').length;

  async function generateInsight(summaryId: string) {
    setAiLoading((prev) => ({ ...prev, [summaryId]: true }));
    setAiErrors((prev) => ({ ...prev, [summaryId]: '' }));
    try {
      const res = await fetch('/api/ops/summary/ai-insight', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ summary_id: summaryId }),
      });
      const j = await res.json();
      if (!res.ok) {
        setAiErrors((prev) => ({ ...prev, [summaryId]: j?.error?.message ?? 'AI gagal' }));
        return;
      }
      setAiInsights((prev) => ({ ...prev, [summaryId]: j.data.ai_insight }));
      router.refresh();
    } finally {
      setAiLoading((prev) => ({ ...prev, [summaryId]: false }));
    }
  }

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Analytics & Configurations</h1>
        <p className='text-sm text-slate-500'>KPI agregat + regenerate summary + AI insight.</p>
      </div>

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Kpi label='Summary rows' value={String(summaries.length)} />
        <Kpi label='Open high incidents' value={String(high)} tone={high > 0 ? 'warn' : 'ok'} />
        <Kpi label='Waste value' value={new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(wasteValue)} />
        <Kpi label='Orders over SLA' value={String(overSla)} tone={overSla > 0 ? 'warn' : 'ok'} />
      </div>

      <RegenerateButton />

      <div className='rounded-xl border bg-white p-4'>
        <h2 className='mb-3 font-semibold'>All Summaries</h2>
        {summaries.length === 0 ? (
          <p className='text-sm text-slate-500'>Belum ada summary. Klik Regenerate.</p>
        ) : (
          <ul className='space-y-3'>
            {summaries.slice().reverse().map((r) => (
              <li key={r.summary_id} className='rounded border p-3 text-sm space-y-2'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='font-medium'>{r.date} — {r.outlet_name}</span>
                  <span className='text-xs text-slate-500'>Open {r.opening_completion_percentage}% · Orders {r.total_orders} · {r.major_ops_issue}</span>
                </div>
                {(r.ai_insight || aiInsights[r.summary_id]) && (
                  <div className='rounded bg-indigo-50 p-3 text-sm text-indigo-900 whitespace-pre-wrap'>
                    <div className='mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700'>AI Insight</div>
                    {aiInsights[r.summary_id] ?? r.ai_insight}
                  </div>
                )}
                <button
                  onClick={() => generateInsight(r.summary_id)}
                  disabled={aiLoading[r.summary_id]}
                  className='rounded bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-50'
                >
                  {aiLoading[r.summary_id] ? 'Generating…' : 'Generate AI Insight'}
                </button>
                {aiErrors[r.summary_id] && <div className='text-xs text-red-600'>{aiErrors[r.summary_id]}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = 'ok' }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${tone === 'warn' ? 'border-amber-300' : ''}`}>
      <div className='text-xs text-slate-500'>{label}</div>
      <div className='mt-1 text-2xl font-bold'>{value}</div>
    </div>
  );
}

function RegenerateButton() {
  return (
    <form action='/api/ops/summary/regenerate' method='POST' className='inline-block'>
      <button
        type='submit'
        className='rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
      >
        Regenerate Daily Summary
      </button>
    </form>
  );
}
