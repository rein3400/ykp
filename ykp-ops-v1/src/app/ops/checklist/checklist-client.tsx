'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { selectChecklistTemplates } from '@/lib/checklist';

export function ChecklistClient({
  templates,
  outlets,
  shifts,
  submissions: serverSubmissions,
}: {
  templates: Record<string, string>[];
  outlets: Record<string, string>[];
  shifts: Record<string, string>[];
  submissions: Record<string, string>[];
}) {
  const router = useRouter();
  const [submissions, setSubmissions] = useState(serverSubmissions);

  const refetch = () => {
    fetch('/api/ops/checklist', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        const items = Array.isArray(j?.data) ? j.data : (j?.data?.items ?? []);
        if (Array.isArray(items) && items.length) setSubmissions(items);
      })
      .catch(() => {});
  };
  useEffect(refetch, []);

  const [outletId, setOutletId] = useState(outlets[0]?.outlet_id ?? '');
  const [shiftId, setShiftId] = useState(shifts[0]?.shift_id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeTemplates = useMemo(
    () => templates.filter((t) => (t.active_status || 'active').toLowerCase() === 'active'),
    [templates]
  );
  const types = useMemo(
    () => Array.from(new Set(activeTemplates.map((t) => (t.checklist_type || 'GENERAL').toUpperCase()))),
    [activeTemplates]
  );
  const [type, setType] = useState(types[0] ?? 'GENERAL');
  const filtered = useMemo(() => selectChecklistTemplates(activeTemplates, type, outletId, outlets.find((row) => row.outlet_id === outletId)?.brand_id ?? ''), [activeTemplates, type, outletId, outlets]);
  const departments = useMemo(() => Array.from(new Set(filtered.map((t) => t.department || ''))).filter(Boolean), [filtered]);

  // Per-item selection state keyed by template id.
  const [checks, setChecks] = useState<Record<string, { done: boolean; notes: string }>>({});

  // Reset selections when the type/outlet/shift changes.
  useEffect(() => {
    setChecks({});
  }, [type, outletId, shiftId]);

  function setItem(id: string, patch: Partial<{ done: boolean; notes: string }>) {
    setChecks((c) => ({ ...c, [id]: { ...(c[id] ?? { done: true, notes: '' }), ...patch } }));
  }

  async function submit() {
    setLoading(true);
    setError('');
    if (filtered.length === 0) {
      setError('Tidak ada item checklist untuk tipe ini. Isi master template dulu.');
      setLoading(false);
      return;
    }
    try {
      const items = filtered.map((t) => {
        const s = checks[t.checklist_template_id] ?? { done: true, notes: '' };
        return {
          checklist_item: t.checklist_item,
          department: t.department ?? '',
          status: s.done ? 'DONE' : 'NOT_DONE',
          notes: s.notes,
          critical_flag: t.critical_flag,
        };
      });
      const res = await fetch('/api/ops/checklist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ outlet_id: outletId, shift_id: shiftId, checklist_type: type, items }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j?.error?.message ?? `Gagal menyimpan (HTTP ${res.status})`); return; }
      refetch();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghubungi server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3'>
        <label className='text-xs font-medium text-slate-600'>
          Outlet
          <select className='mt-1 block w-full rounded border px-2 py-1.5 text-sm' value={outletId} onChange={(e) => setOutletId(e.target.value)}>
            {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
          </select>
        </label>
        <label className='text-xs font-medium text-slate-600'>
          Shift
          <select className='mt-1 block w-full rounded border px-2 py-1.5 text-sm' value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            {shifts.map((s) => <option key={s.shift_id} value={s.shift_id}>{s.shift_name}</option>)}
          </select>
        </label>
        <label className='text-xs font-medium text-slate-600'>
          Tipe Checklist
          <select className='mt-1 block w-full rounded border px-2 py-1.5 text-sm' value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      {error && <div className='rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>{error}</div>}

      <div className='rounded-xl border bg-white p-4'>
        <div className='mb-3 flex items-center justify-between'>
          <h2 className='font-semibold'>Item SOP — {type}</h2>
          <span className='text-xs text-slate-500'>
            {filtered.filter((t) => (checks[t.checklist_template_id]?.done ?? true)).length}/{filtered.length} selesai
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className='text-sm text-slate-500'>Tidak ada item checklist untuk tipe ini.</p>
        ) : departments.length === 0 ? (
          <div className='space-y-1'>
            {filtered.map((t) => (
              <CheckRow key={t.checklist_template_id} t={t} state={checks[t.checklist_template_id] ?? { done: true, notes: '' }} onSet={(p) => setItem(t.checklist_template_id, p)} />
            ))}
          </div>
        ) : (
          departments.map((dep) => (
            <div key={dep} className='mb-4'>
              <h3 className='mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500'>{dep}</h3>
              <div className='space-y-1'>
                {filtered.filter((t) => (t.department || '') === dep).map((t) => (
                  <CheckRow key={t.checklist_template_id} t={t} state={checks[t.checklist_template_id] ?? { done: true, notes: '' }} onSet={(p) => setItem(t.checklist_template_id, p)} />
                ))}
              </div>
            </div>
          ))
        )}

        <button
          onClick={submit}
          disabled={loading}
          className='mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50'
        >
          {loading ? 'Menyimpan…' : 'Simpan & Verifikasi Checklist'}
        </button>
      </div>

      <TemplateManager templates={templates} outletId={outletId} onChanged={() => router.refresh()} />

      <div className='rounded-xl border bg-white p-4'>
        <h2 className='mb-3 font-semibold'>Riwayat Verifikasi</h2>
        {submissions.length === 0 ? (
          <p className='text-sm text-slate-500'>Belum ada submission checklist.</p>
        ) : (
          <ul className='space-y-2'>
            {submissions.filter((r) => r.status !== 'VOID').slice().reverse().map((r) => (
              <li key={r.submission_id} className='rounded border p-3 text-sm'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='font-medium'>{r.checklist_item}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${r.status === 'DONE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                  <span className='text-xs text-slate-500'>{r.checklist_type} · {r.department || '—'}</span>
                </div>
                {r.notes && <div className='mt-1 text-xs text-slate-500'>Catatan: {r.notes}</div>}
                <div className='mt-1 text-xs text-slate-500'>{r.outlet_id} · {r.date} · {r.shift_id || '—'} · verif {r.verified_by}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CheckRow({
  t,
  state,
  onSet,
}: {
  t: Record<string, string>;
  state: { done: boolean; notes: string };
  onSet: (patch: Partial<{ done: boolean; notes: string }>) => void;
}) {
  return (
    <div className='flex flex-col gap-1 rounded border border-slate-200 p-2 sm:flex-row sm:items-center'>
      <label className='flex flex-1 cursor-pointer items-center gap-2 text-sm'>
        <input
          type='checkbox'
          checked={state.done}
          onChange={(e) => onSet({ done: e.target.checked })}
          className='h-4 w-4 rounded border-slate-300'
        />
        <span className={t.critical_flag === 'true' ? 'font-medium text-slate-900' : 'text-slate-700'}>
          {t.checklist_item}
        </span>
        {t.critical_flag === 'true' && (
          <span className='rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700'>CRITICAL</span>
        )}
      </label>
      <input
        type='text'
        placeholder='Catatan (opsional)'
        value={state.notes}
        onChange={(e) => onSet({ notes: e.target.value })}
        className='w-full rounded border px-2 py-1 text-xs sm:w-56'
      />
    </div>
  );
}

function TemplateManager({ templates, outletId, onChanged }: { templates: Record<string, string>[]; outletId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState('');
  const [dept, setDept] = useState('Kitchen');
  const [type, setType] = useState('OPENING');
  const [critical, setCritical] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const active = templates.filter((t) => (t.active_status || 'active').toLowerCase() === 'active');

  async function add() {
    if (!item.trim()) { setMsg('Nama item wajib diisi'); return; }
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/ops/checklist-templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          outlet_id: outletId,
          checklist_type: type,
          department: dept,
          checklist_item: item.trim(),
          critical_flag: critical ? 'true' : 'false',
          required_photo: photo ? 'true' : 'false',
          target_value: target
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      setMsg(`✓ "${item.trim()}" ditambahkan ke ${type}/${dept}`);
      setItem(''); setTarget(''); setCritical(false); setPhoto(false);
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menambah template');
    } finally { setBusy(false); }
  }

  async function toggleActive(id: string, current: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/ops/checklist-templates', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ checklist_template_id: id, active_status: current === 'active' ? 'inactive' : 'active' })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      }
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal mengubah template');
    } finally { setBusy(false); }
  }

  return (
    <div className='rounded-xl border bg-white p-4'>
      <button onClick={() => setOpen(!open)} className='flex w-full items-center justify-between text-left'>
        <span className='font-semibold'>Kelola Master Template <span className='text-xs font-normal text-slate-400'>({active.length} item aktif)</span></span>
        <span className='text-xs text-slate-500'>{open ? '▲ tutup' : '▼ buka'}</span>
      </button>

      {open && (
        <div className='mt-4 space-y-4'>
          <div className='rounded-lg border bg-slate-50 p-3'>
            <div className='text-xs font-semibold text-slate-700'>Tambah Item Baru</div>
            <div className='mt-2 grid gap-2 sm:grid-cols-2'>
              <input value={item} onChange={(e) => setItem(e.target.value)} placeholder='Nama item checklist…' className='rounded border px-2 py-1 text-sm' />
              <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder='Target (opsional, mis. 1–4°C)' className='rounded border px-2 py-1 text-sm' />
              <select value={type} onChange={(e) => setType(e.target.value)} className='rounded border px-2 py-1 text-sm'>
                <option value='OPENING'>OPENING</option>
                <option value='CLOSING'>CLOSING</option>
                <option value='GENERAL'>GENERAL</option>
              </select>
              <select value={dept} onChange={(e) => setDept(e.target.value)} className='rounded border px-2 py-1 text-sm'>
                <option>Kitchen</option><option>Bar</option><option>FOH</option><option>Hygiene</option><option>Umum</option>
              </select>
            </div>
            <div className='mt-2 flex flex-wrap items-center gap-4 text-xs'>
              <label className='flex items-center gap-1'>
                <input type='checkbox' checked={critical} onChange={(e) => setCritical(e.target.checked)} /> Kritikal
              </label>
              <label className='flex items-center gap-1'>
                <input type='checkbox' checked={photo} onChange={(e) => setPhoto(e.target.checked)} /> Foto wajib
              </label>
              <button onClick={add} disabled={busy} className='rounded bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-50'>
                {busy ? '…' : '+ Tambah Template'}
              </button>
            </div>
            {msg && <div className='mt-2 text-xs text-slate-600'>{msg}</div>}
          </div>

          <div className='max-h-80 space-y-1 overflow-y-auto'>
            {active.map((t) => (
              <div key={t.checklist_template_id} className='flex items-center gap-2 rounded border p-2 text-xs'>
                <span className='font-mono text-slate-400'>{t.checklist_template_id}</span>
                <span className='rounded bg-slate-100 px-1.5 py-0.5'>{t.checklist_type}</span>
                <span className='rounded bg-blue-50 px-1.5 py-0.5 text-blue-700'>{t.department || 'Umum'}</span>
                <span className='flex-1 truncate'>{t.checklist_item}</span>
                {t.critical_flag === 'true' && <span className='rounded bg-red-100 px-1 py-0.5 font-semibold text-red-700'>KRITIKAL</span>}
                {t.required_photo === 'true' && <span title='Foto wajib'>📷</span>}
                {t.target_value && <span className='text-slate-500'>target: {t.target_value}</span>}
                <button onClick={() => toggleActive(t.checklist_template_id, t.active_status ?? 'active')} disabled={busy} className='ml-1 rounded border px-2 py-0.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50'>
                  Nonaktifkan
                </button>
              </div>
            ))}
          </div>
          <p className='text-xs text-slate-400'>Item dinonaktifkan tidak muncul di form pengisian & tetap tersimpan untuk riwayat. Untuk mengubah teks item, edit tab <code className='rounded bg-slate-100 px-1'>master_checklist_template</code> di Google Sheets.</p>
        </div>
      )}
    </div>
  );
}
