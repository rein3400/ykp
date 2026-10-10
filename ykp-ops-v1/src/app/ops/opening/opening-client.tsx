'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { selectChecklistTemplates } from '@/lib/checklist';

type ItemState = {
  checklist_item: string;
  critical_flag: string;
  status: 'DONE' | 'NOT_DONE';
  notes: string;
  photo_url: string;
};

export function OpeningClient({
  templates,
  outlets,
  shifts,
  rows: serverRows,
}: {
  templates: Record<string, string>[];
  outlets: Record<string, string>[];
  shifts: Record<string, string>[];
  rows: Record<string, string>[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(serverRows);
  const refetch = () => {
    fetch('/api/ops/opening', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        const items = Array.isArray(j?.data) ? j.data : (j?.data?.items ?? j?.data?.opening ?? []);
        if (Array.isArray(items) && items.length) setRows(items);
      })
      .catch(() => {});
  };
  useEffect(refetch, []);

  const [outletId, setOutletId] = useState(outlets[0]?.outlet_id ?? '');
  const [shiftId, setShiftId] = useState(shifts[0]?.shift_id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedTemplates = useMemo(() => {
    const outlet = outlets.find((row) => row.outlet_id === outletId);
    return outlet ? selectChecklistTemplates(templates, 'OPENING', outletId, outlet.brand_id ?? '') : [];
  }, [templates, outletId, outlets]);

  const [items, setItems] = useState<ItemState[]>(() =>
    selectedTemplates.map((t) => ({
      checklist_item: t.checklist_item,
      critical_flag: t.critical_flag,
      status: 'NOT_DONE' as const,
      notes: '',
      photo_url: '',
    }))
  );

  useEffect(() => {
    setItems(
      selectedTemplates.map((t) => ({
        checklist_item: t.checklist_item,
        critical_flag: t.critical_flag,
        status: 'NOT_DONE' as const,
        notes: '',
        photo_url: '',
      }))
    );
  }, [selectedTemplates]);

  function toggleStatus(idx: number) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], status: next[idx].status === 'DONE' ? 'NOT_DONE' : 'DONE' };
      return next;
    });
  }

  function setItemField(idx: number, field: keyof ItemState, value: string) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  const grouped = useMemo(() => {
    const m = new Map<string, { dept: string; list: Array<ItemState & { idx: number }> }>();
    items.forEach((it, idx) => {
      const dept = selectedTemplates[idx]?.department ?? 'Umum';
      if (!m.has(dept)) m.set(dept, { dept, list: [] });
      m.get(dept)!.list.push({ ...it, idx });
    });
    return Array.from(m.values());
  }, [items, selectedTemplates]);

  const doneCount = items.filter((i) => i.status === 'DONE').length;
  const criticalNotDone = items.filter((i) => i.critical_flag === 'true' && i.status !== 'DONE').length;

  async function submitAll() {
    setLoading(true);
    setError('');
    setSuccess('');
    if (selectedTemplates.length === 0) {
      setError('Tidak ada item checklist OPENING. Isi master template dulu.');
      setLoading(false);
      return;
    }
    if (items.length === 0) {
      setError('Tidak ada item untuk di-submit.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/ops/opening', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          shift_id: shiftId,
          items: items.map((it) => ({
            checklist_item: it.checklist_item,
            critical_flag: it.critical_flag,
            status: it.status,
            notes: it.notes,
            photo_url: it.photo_url,
          })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error?.message ?? `Gagal menyimpan (HTTP ${res.status})`);
        return;
      }
      setSuccess(`Tersimpan ${j.data?.count ?? items.length} item. ${criticalNotDone > 0 ? `⚠ ${criticalNotDone} item kritikal belum DONE` : '✅ Semua item kritikal DONE'}`);
      setItems((prev) => prev.map((it) => ({ ...it, status: 'NOT_DONE' as const, notes: '', photo_url: '' })));
      refetch();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghubungi server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='min-w-0 space-y-6 pb-6'>
      <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'>
        <p className='text-xs font-semibold uppercase tracking-widest text-slate-500'>Persiapan pembukaan</p>
        <div className='mt-3 flex flex-wrap items-center justify-between gap-3'>
          <p className='text-sm font-medium text-slate-700'>{`${doneCount} dari ${items.length}`} item selesai</p>
          <span className='text-sm font-semibold tabular-nums text-emerald-700'>{items.length ? Math.round(doneCount / items.length * 100) : 0}%</span>
        </div>
        <div role='progressbar' aria-label='Progres opening' aria-valuemin={0} aria-valuemax={items.length || 1} aria-valuenow={doneCount} className='mt-3 h-2 overflow-hidden rounded-full bg-slate-100'>
          <div className='h-full rounded-full bg-emerald-600 transition-[width] motion-reduce:transition-none' style={{ width: `${items.length ? doneCount / items.length * 100 : 0}%` }} />
        </div>
        <p className='mt-4 text-xs leading-5 text-slate-500'>{grouped.length} kategori SOP. Lengkapi tugas, catatan, dan bukti yang diperlukan sebelum membuka outlet.</p>
      </div>

      <div className='grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6'>
        <label className='text-sm'>Outlet
          <select disabled={loading} className='mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-50' value={outletId} onChange={(e) => setOutletId(e.target.value)}>
            {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
          </select>
        </label>
        <label className='text-sm'>Shift
          <select disabled={loading} className='mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-50' value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            {shifts.map((s) => <option key={s.shift_id} value={s.shift_id}>{s.shift_name}</option>)}
          </select>
        </label>
      </div>

      <div className='flex flex-wrap items-center gap-2 text-xs'>
        <span className='rounded bg-slate-100 px-2 py-1'>{doneCount}/{items.length} DONE</span>
        {criticalNotDone > 0 && <span className='rounded bg-red-100 px-2 py-1 font-medium text-red-700'>⚠ {criticalNotDone} KRITIKAL belum DONE</span>}
        {criticalNotDone === 0 && items.length > 0 && <span className='rounded bg-green-100 px-2 py-1 font-medium text-green-700'>✅ Kritikal aman</span>}
      </div>

      {selectedTemplates.length === 0 ? (
        <div className='rounded-lg border border-dashed bg-slate-50 p-4 text-sm'>
          <div className='font-medium'>Tidak ada item checklist OPENING untuk outlet ini.</div>
          <div className='mt-1 text-slate-600'>Isi master template dulu — 2 cara:</div>
          <ol className='mt-2 list-decimal pl-5 text-slate-600'>
            <li><b>Via aplikasi (disarankan):</b> buka <a href='/ops/checklist' className='text-blue-600 underline'>Checklist Operasional → Kelola Template</a> lalu tambah item dengan Tipe = OPENING.</li>
            <li><b>Via Google Sheets:</b> buka tab <code className='rounded bg-white px-1'>master_checklist_template</code> → isi baris baru: <code>checklist_type=OPENING</code>, <code>department</code>, <code>checklist_item</code>, <code>critical_flag</code>.</li>
          </ol>
          <div className='mt-3'>
            <QuickAddTemplate outletId={outletId} onAdded={() => { router.refresh(); setTimeout(refetch, 500); }} />
          </div>
        </div>
      ) : (
        <div className='space-y-4'>
          {grouped.map(({ dept, list }) => (
            <div key={dept} className='overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
              <h3 className='mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4 text-sm font-semibold text-slate-800'><span className='min-w-0 break-words'>{dept}</span><span className='shrink-0 text-xs font-normal tabular-nums text-slate-500'>{list.filter((item) => item.status === 'DONE').length}/{list.length}</span></h3>
              <div className='space-y-3'>
                {list.map(({ idx, ...it }) => {
                  const tpl = selectedTemplates[idx];
                  return (
                    <div key={idx} className={`rounded-xl border p-4 ${it.status === 'DONE' ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100 bg-white'}`}>
                      <label className='flex cursor-pointer items-start gap-3'>
                        <input
                          type='checkbox'
                          checked={it.status === 'DONE'}
                          onChange={() => toggleStatus(idx)}
                          disabled={loading} className='mt-0.5 h-5 w-5 shrink-0 accent-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600'
                        />
                        <div className='min-w-0 flex-1'>
                          <div className='flex flex-wrap items-center gap-2 text-sm'>
                            <span className={`break-words text-sm leading-6 ${it.status === 'DONE' ? 'text-emerald-900' : 'text-slate-700'}`}>{it.checklist_item}</span>
                            {it.critical_flag === 'true' && <span className='rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700'>KRITIKAL</span>}
                            {tpl?.required_photo === 'true' && <span title='Foto wajib' className='text-xs'>📷</span>}
                            {tpl?.target_value && <span className='rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600'>target {tpl.target_value}</span>}
                          </div>

                        </div>
                      </label>
                      <details className='ml-8 mt-3'>
                        <summary className='w-fit cursor-pointer rounded text-xs font-medium text-slate-500 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600'>Catatan &amp; bukti{it.notes || it.photo_url ? ' · terisi' : ''}</summary>
                        <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                          <label className='text-xs font-medium text-slate-500'>Catatan<textarea disabled={loading} rows={2} aria-label={`Catatan ${it.checklist_item}`} placeholder='Kendala atau informasi tambahan' value={it.notes} onChange={(e) => setItemField(idx, 'notes', e.target.value)} className='mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20' /></label>
                          <label className='text-xs font-medium text-slate-500'>Link foto {tpl?.required_photo === 'true' ? '(wajib)' : '(opsional)'}<input disabled={loading} type='url' aria-label={`Foto ${it.checklist_item}`} placeholder='https://' value={it.photo_url} onChange={(e) => setItemField(idx, 'photo_url', e.target.value)} className='mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20' /></label>
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className='rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>{error}</div>}
      {success && <div className='rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700'>{success}</div>}

      <div className='sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-5'>
        <div><p className='text-sm font-medium text-slate-700'>{outlets.find((o) => o.outlet_id === outletId)?.outlet_name || 'Pilih outlet'} · {shifts.find((s) => s.shift_id === shiftId)?.shift_name || 'Pilih shift'}</p><p className='mt-1 text-xs leading-5 text-slate-500'>Pastikan tugas kritikal dan bukti telah diperiksa sebelum membuka outlet.</p></div>
        <button onClick={submitAll} disabled={loading || selectedTemplates.length === 0} className='shrink-0 whitespace-nowrap rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500'>
          {loading ? 'Menyimpan…' : `Simpan Opening (${doneCount}/${items.length})`}
        </button>
      </div>

      <div className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <h2 className='mb-4 text-lg font-semibold tracking-tight text-slate-900'>Riwayat Opening</h2>
        {rows.length === 0 ? (
          <p className='text-sm text-slate-500'>Belum ada riwayat opening.</p>
        ) : (
          <ul className='space-y-2'>
            {rows.slice().reverse().slice(0, 30).map((r) => (
              <li key={r.opening_id} className='rounded border p-3 text-sm'>
                <span className='font-medium'>{r.checklist_item}</span>
                <span className={`ml-2 rounded px-2 py-0.5 text-xs ${r.status === 'DONE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                {r.critical_flag === 'true' && <span className='ml-1 rounded bg-red-100 px-1 py-0.5 text-[10px] text-red-700'>KRITIKAL</span>}
                {r.notes && <div className='mt-1 text-xs text-slate-600'>📝 {r.notes}</div>}
                {r.photo_url && <a href={r.photo_url} target='_blank' rel='noreferrer' className='mt-1 block truncate text-xs text-blue-600 underline'>{r.photo_url}</a>}
                <div className='mt-1 text-xs text-slate-400'>{r.outlet_id} · {r.date} · {r.completed_by} {r.critical_flag === 'true' ? '· kritikal' : ''}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function QuickAddTemplate({ outletId, onAdded }: { outletId: string; onAdded: () => void }) {
  const [item, setItem] = useState('');
  const [dept, setDept] = useState('Kitchen');
  const [critical, setCritical] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function add() {
    if (!item.trim()) { setMsg('Nama item wajib diisi'); return; }
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/ops/checklist-templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          checklist_type: 'OPENING',
          department: dept,
          checklist_item: item.trim(),
          critical_flag: critical ? 'true' : 'false',
          required_photo: 'false'
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      setMsg(`✓ "${item.trim()}" ditambahkan — refresh halaman`);
      setItem('');
      setCritical(false);
      onAdded();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menambah template');
    } finally { setBusy(false); }
  }

  return (
    <div className='rounded-lg border bg-white p-3'>
      <div className='text-xs font-medium text-slate-700'>Tambah item cepat (tanpa buka Sheets)</div>
      <div className='mt-2 flex flex-wrap gap-2'>
        <input value={item} onChange={(e) => setItem(e.target.value)} placeholder='Nama item checklist…' className='min-w-[200px] flex-1 rounded border px-2 py-1 text-xs' />
        <select value={dept} onChange={(e) => setDept(e.target.value)} className='rounded border px-2 py-1 text-xs'>
          <option>Kitchen</option><option>Bar</option><option>FOH</option><option>Hygiene</option><option>Umum</option>
        </select>
        <label className='flex items-center gap-1 text-xs'>
          <input type='checkbox' checked={critical} onChange={(e) => setCritical(e.target.checked)} /> Kritikal
        </label>
        <button onClick={add} disabled={busy} className='rounded bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-50'>
          {busy ? '…' : '+ Tambah'}
        </button>
      </div>
      {msg && <div className='mt-2 text-xs text-slate-600'>{msg}</div>}
    </div>
  );
}