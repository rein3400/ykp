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
    <div className='space-y-4'>
      <div className='rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs'>
        <div className='font-semibold text-amber-800'>SOP Opening — {selectedTemplates.length} item ({new Set(selectedTemplates.map((template) => template.department || 'Umum')).size} kategori)</div>
        <div className='mt-1 text-amber-700'>Isi manual per item: centang DONE, tambah catatan & link foto jika diperlukan (wajib foto untuk item bertanda 📷). Item <span className='rounded bg-red-100 px-1 font-medium text-red-700'>KRITIKAL</span> harus DONE sebelum buka.</div>
      </div>

      <div className='grid gap-3 sm:grid-cols-2'>
        <label className='text-sm'>Outlet
          <select className='mt-1 w-full rounded border px-3 py-2 text-sm' value={outletId} onChange={(e) => setOutletId(e.target.value)}>
            {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
          </select>
        </label>
        <label className='text-sm'>Shift
          <select className='mt-1 w-full rounded border px-3 py-2 text-sm' value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
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
            <div key={dept} className='rounded-xl border bg-white p-4'>
              <h3 className='mb-3 text-sm font-semibold'>{dept} <span className='font-normal text-slate-400'>— {list.length} item</span></h3>
              <div className='space-y-3'>
                {list.map(({ idx, ...it }) => {
                  const tpl = selectedTemplates[idx];
                  return (
                    <div key={idx} className={`rounded-lg border p-3 ${it.status === 'DONE' ? 'border-green-200 bg-green-50/50' : it.critical_flag === 'true' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
                      <label className='flex cursor-pointer items-start gap-3'>
                        <input
                          type='checkbox'
                          checked={it.status === 'DONE'}
                          onChange={() => toggleStatus(idx)}
                          className='mt-1 h-4 w-4 rounded border-slate-300'
                        />
                        <div className='flex-1'>
                          <div className='flex flex-wrap items-center gap-2 text-sm'>
                            <span className={it.status === 'DONE' ? 'font-medium text-green-700 line-through' : 'font-medium'}>{it.checklist_item}</span>
                            {it.critical_flag === 'true' && <span className='rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700'>KRITIKAL</span>}
                            {tpl?.required_photo === 'true' && <span title='Foto wajib' className='text-xs'>📷</span>}
                            {tpl?.target_value && <span className='rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600'>target {tpl.target_value}</span>}
                          </div>
                          <div className='mt-2 grid gap-2 sm:grid-cols-2'>
                            <input
                              placeholder='Catatan (opsional)'
                              value={it.notes}
                              onChange={(e) => setItemField(idx, 'notes', e.target.value)}
                              className='rounded border px-2 py-1 text-xs'
                            />
                            <input
                              placeholder='Link foto (opsional, wajib jika 📷)'
                              value={it.photo_url}
                              onChange={(e) => setItemField(idx, 'photo_url', e.target.value)}
                              className='rounded border px-2 py-1 text-xs'
                            />
                          </div>
                        </div>
                      </label>
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

      <button onClick={submitAll} disabled={loading || selectedTemplates.length === 0} className='rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50'>
        {loading ? 'Menyimpan…' : `Simpan Opening (${doneCount}/${items.length})`}
      </button>

      <div className='rounded-xl border bg-white p-4'>
        <h2 className='mb-3 font-semibold'>Riwayat Opening</h2>
        {rows.length === 0 ? (
          <p className='text-sm text-slate-500'>Belum ada opening checklist.</p>
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