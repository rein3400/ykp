'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function IncidentsClient({
  rows: serverRows,
  outlets,
}: {
  rows: Record<string, string>[];
  outlets: Record<string, string>[];
}) {
  const router = useRouter();
  // In mock mode on serverless, the server-component page and the API route
  // run in different function instances, so the page's store is empty. The
  // GET /api/ops/incidents route shares an instance with POST, so it has the
  // data — fetch it client-side and prefer it over the (empty) server rows.
  const [rows, setRows] = useState(serverRows);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/ops/incidents', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        const items = Array.isArray(j?.data) ? j.data : (j?.data?.items ?? j?.data?.incidents ?? []);
        if (!cancelled && Array.isArray(items) && items.length) setRows(items);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [outletId, setOutletId] = useState(outlets[0]?.outlet_id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [type, setType] = useState('OPERATIONAL');
  const [customerName, setCustomerName] = useState('');
  const [channel, setChannel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ops/incidents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          title,
          description,
          severity,
          incident_type: type,
          customer_name: customerName,
          channel,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j?.error?.message ?? `Gagal menyimpan (HTTP ${res.status})`); return; }
      setTitle('');
      setDescription('');
      setCustomerName('');
      setChannel('');
      // Re-fetch from the API instance (which has the data in mock mode) and
      // also refresh the server component for real-DB mode.
      fetch('/api/ops/incidents', { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => {
          const items = Array.isArray(j?.data) ? j.data : (j?.data?.items ?? j?.data?.incidents ?? []);
          if (Array.isArray(items)) setRows(items);
        })
        .catch(() => {});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghubungi server');
    } finally { setLoading(false); }
  }

  return (
    <div className='space-y-4'>
      <div className='rounded-xl border bg-white p-4 space-y-3'>
        <h2 className='font-semibold'>Lapor Incident</h2>
        {error && <div className='text-sm text-red-600'>{error}</div>}
        <div className='grid gap-3 sm:grid-cols-2'>
          <select className='rounded border px-3 py-2 text-sm' value={outletId} onChange={(e) => setOutletId(e.target.value)}>
            {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
          </select>
          <select className='rounded border px-3 py-2 text-sm' value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className='rounded border px-3 py-2 text-sm' value={type} onChange={(e) => setType(e.target.value)}>
            {['OPERATIONAL', 'COMPLAINT', 'SAFETY', 'EQUIPMENT', 'OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            className='rounded border px-3 py-2 text-sm'
            placeholder='Channel (WA/Phone/In-store)'
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          />
          <input
            className='rounded border px-3 py-2 text-sm sm:col-span-2'
            placeholder='Judul insiden'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className='rounded border px-3 py-2 text-sm sm:col-span-2'
            placeholder='Deskripsi detail'
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {type === 'COMPLAINT' && (
            <input
              className='rounded border px-3 py-2 text-sm sm:col-span-2'
              placeholder='Nama customer (opsional)'
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          )}
        </div>
        <button onClick={submit} disabled={loading || !title.trim()} className='rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50'>
          {loading ? 'Simpan…' : 'Submit'}
        </button>
      </div>
      <div className='rounded-xl border bg-white p-4'>
        <h2 className='mb-3 font-semibold'>Daftar Incident</h2>
        {rows.length === 0 ? (
          <p className='text-sm text-slate-500'>Belum ada incident.</p>
        ) : (
          <ul className='space-y-3'>
            {rows.slice().reverse().map((r) => (
              <IncidentCard key={r.incident_id} row={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function IncidentCard({ row }: { row: Record<string, string> }) {
  const [ai, setAi] = useState<Record<string, unknown> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [draft, setDraft] = useState(row.ai_response_draft ?? '');
  const [status, setStatus] = useState(row.status);
  const [assignedTo, setAssignedTo] = useState(row.assigned_to ?? '');
  const [resolutionNotes, setResolutionNotes] = useState(row.resolution_notes ?? '');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const triage = parseJson(row.ai_triage);
  const sentiment = parseJson(row.ai_sentiment);

  async function generateAi() {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch(`/api/ops/incidents/${row.incident_id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' }),
      });
      const j = await res.json();
      if (!res.ok) { setAiError(j?.error?.message ?? 'AI gagal'); return; }
      setAi(j.data);
      setDraft(j.data.response_draft as string);
      router.refresh();
    } finally { setAiLoading(false); }
  }

  async function generateDraft() {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch(`/api/ops/incidents/${row.incident_id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'draft' }),
      });
      const j = await res.json();
      if (!res.ok) { setAiError(j?.error?.message ?? 'AI gagal'); return; }
      setDraft(j.data.draft as string);
    } finally { setAiLoading(false); }
  }

  async function updateIncident() {
    setUpdateLoading(true);
    try {
      const res = await fetch(`/api/ops/incidents/${row.incident_id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status,
          assigned_to: assignedTo,
          resolution_notes: resolutionNotes,
          ai_response_draft: draft,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setAiError(j?.error?.message ?? 'Update gagal'); return; }
      router.refresh();
    } finally { setUpdateLoading(false); }
  }

  function copyDraft() {
    if (!draft) return;
    navigator.clipboard.writeText(draft).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <li className='rounded border p-3 text-sm space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='font-medium'>{row.title}</span>
        <SeverityBadge severity={row.severity} />
        <StatusBadge status={row.status} />
        <span className='text-xs text-slate-500'>{row.incident_type} · {row.date}</span>
      </div>
      <div className='text-slate-600'>{row.description}</div>
      {row.customer_name && <div className='text-xs text-slate-500'>Customer: {row.customer_name}</div>}

      {(triage || sentiment) && (
        <div className='rounded bg-slate-50 p-3 space-y-2'>
          {triage && (
            <div className='text-xs'>
              <span className='font-semibold'>AI Triage:</span> {triage.suggested_severity} — {triage.reasoning} ({triage.category})
            </div>
          )}
          {sentiment && (
            <div className='text-xs'>
              <span className='font-semibold'>Sentiment:</span> {sentiment.customer_sentiment} · urgency {sentiment.urgency} — {sentiment.reasoning}
            </div>
          )}
        </div>
      )}

      <div className='space-y-2'>
        <label className='text-xs font-semibold text-slate-700'>AI Response Draft</label>
        <textarea
          className='w-full rounded border px-3 py-2 text-sm'
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='Klik tombol di bawah untuk generate draft AI...'
        />
        <div className='flex flex-wrap gap-2'>
          <button onClick={generateAi} disabled={aiLoading} className='rounded bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-50'>
            {aiLoading ? 'AI…' : 'AI Analyze'}
          </button>
          <button onClick={generateDraft} disabled={aiLoading} className='rounded bg-slate-200 px-3 py-1.5 text-xs text-slate-800 disabled:opacity-50'>
            Draft Only
          </button>
          <button onClick={copyDraft} disabled={!draft} className='rounded bg-slate-100 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50'>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {aiError && <div className='text-xs text-red-600'>{aiError}</div>}
      </div>

      <div className='grid gap-2 sm:grid-cols-3'>
        <select className='rounded border px-2 py-1.5 text-xs' value={status} onChange={(e) => setStatus(e.target.value)}>
          {['OPEN', 'INVESTIGATING', 'ACTION_REQUIRED', 'WAITING_APPROVAL', 'RESOLVED', 'CLOSED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          className='rounded border px-2 py-1.5 text-xs'
          placeholder='Assigned to'
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
        />
        <input
          className='rounded border px-2 py-1.5 text-xs'
          placeholder='Resolution notes'
          value={resolutionNotes}
          onChange={(e) => setResolutionNotes(e.target.value)}
        />
      </div>
      <button onClick={updateIncident} disabled={updateLoading} className='rounded bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50'>
        {updateLoading ? 'Updating…' : 'Update Incident'}
      </button>
    </li>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const color = severity === 'CRITICAL' || severity === 'HIGH' ? 'bg-red-100 text-red-700' : severity === 'LOW' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
  return <span className={`rounded px-2 py-0.5 text-xs ${color}`}>{severity}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const color = ['RESOLVED', 'CLOSED'].includes(status) ? 'bg-green-100 text-green-700' : status === 'OPEN' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700';
  return <span className={`rounded px-2 py-0.5 text-xs ${color}`}>{status}</span>;
}

function parseJson(s: string): Record<string, string> | null {
  try {
    return s ? JSON.parse(s) as Record<string, string> : null;
  } catch {
    return null;
  }
}
