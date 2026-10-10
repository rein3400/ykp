'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { selectChecklistTemplates } from '@/lib/checklist';

const control = 'mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:bg-slate-50 disabled:text-slate-400';

export function ClosingClient({ rows, outlets, templates, shifts, date }: {
  rows: Record<string, string>[]; outlets: Record<string, string>[];
  templates: Record<string, string>[]; shifts: Record<string, string>[]; date: string;
}) {
  const router = useRouter();
  const [outletId, setOutletId] = useState(outlets[0]?.outlet_id ?? '');
  const [shiftId, setShiftId] = useState(shifts[0]?.shift_id ?? '');
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const outlet = outlets.find((row) => row.outlet_id === outletId);
  const selected = selectChecklistTemplates(templates, 'CLOSING', outletId, outlet?.brand_id ?? '');
  const departments = [...new Set(selected.map((template) => template.department || 'Umum'))];
  const done = selected.filter((template) => values[template.checklist_template_id]?.status === 'DONE').length;
  const percent = selected.length ? Math.round(done / selected.length * 100) : 0;
  function setValue(key: string, field: string, value: string) {
    setSuccess('');
    setValues((previous) => ({ ...previous, [key]: { ...previous[key], [field]: value } }));
  }
  async function submit() {
    setBusy(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/ops/closing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        outlet_id: outletId, shift_id: shiftId, date,
        items: selected.map((template) => ({ checklist_item: template.checklist_item, status: values[template.checklist_template_id]?.status ?? 'NOT_DONE', notes: values[template.checklist_template_id]?.notes ?? '', photo_url: values[template.checklist_template_id]?.photo_url ?? '' }))
      }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error?.message ?? 'Gagal menyimpan'); return; }
      setValues({}); setSuccess('Closing tersimpan. Periksa status hasilnya pada riwayat di bawah.'); router.refresh();
    } catch { setError('Gagal menghubungi server; periksa riwayat sebelum mengirim ulang.'); }
    finally { setBusy(false); }
  }
  return <div className='min-w-0 space-y-8 pb-6'>
    <section aria-label='Konteks closing' className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5'>
        <div><p className='text-xs font-semibold uppercase tracking-widest text-slate-500'>Sesi penutupan</p><p className='mt-1 text-sm text-slate-600'>{date} <span className='text-slate-400'>· WIB</span></p></div>
        <span className='rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600'>{busy ? 'Menyimpan' : done === selected.length && selected.length > 0 ? 'Checklist lengkap' : 'Dalam pengisian'}</span>
      </div>
      <div className='mt-5 grid min-w-0 gap-4 sm:grid-cols-2'>
        <label className='text-xs font-semibold text-slate-600'>Outlet<select className={control} disabled={busy} value={outletId} onChange={(event) => { setOutletId(event.target.value); setValues({}); setError(''); setSuccess(''); }}>
          {outlets.length === 0 && <option value=''>Tidak ada outlet tersedia</option>}
          {outlets.map((row) => <option key={row.outlet_id} value={row.outlet_id}>{row.outlet_name} ({row.outlet_id})</option>)}
        </select></label>
        <label className='text-xs font-semibold text-slate-600'>Shift<select className={control} disabled={busy} value={shiftId} onChange={(event) => { setShiftId(event.target.value); setValues({}); setError(''); setSuccess(''); }}>
          {shifts.length === 0 && <option value=''>Tidak ada shift tersedia</option>}
          {shifts.map((row) => <option key={row.shift_id} value={row.shift_id}>{row.shift_name}</option>)}
        </select></label>
      </div>
      <div className='mt-6'>
        <div className='mb-2 flex items-center justify-between text-sm'><span className='font-medium text-slate-700'>{`${done} dari ${selected.length}`} item selesai</span><span className='font-semibold tabular-nums text-emerald-700'>{percent}%</span></div>
        <div role='progressbar' aria-label='Progres closing' aria-valuemin={0} aria-valuemax={selected.length || 1} aria-valuenow={done} className='h-2 overflow-hidden rounded-full bg-slate-100'><div className='h-full rounded-full bg-emerald-600 transition-[width] motion-reduce:transition-none' style={{ width: `${percent}%` }} /></div>
      </div>
    </section>

    {selected.length === 0 && <div className='rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center'><h2 className='font-semibold text-slate-800'>Template belum tersedia</h2><p className='mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500'>Konfigurasikan template CLOSING untuk outlet ini melalui Kelola Master Template sebelum mengisi checklist.</p></div>}
    {departments.map((department, groupIndex) => {
      const items = selected.filter((template) => (template.department || 'Umum') === department);
      const complete = items.filter((template) => values[template.checklist_template_id]?.status === 'DONE').length;
      return <section key={department} className='overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'>
        <header className='flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-6'>
          <div className='flex min-w-0 items-center gap-3'><span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-500'>{String(groupIndex + 1).padStart(2, '0')}</span><h2 className='min-w-0 break-words text-sm font-semibold text-slate-800'>{department}</h2></div>
          <span className='shrink-0 text-xs tabular-nums text-slate-500'>{complete}/{items.length}</span>
        </header>
        <div className='divide-y divide-slate-100'>
          {items.map((template) => {
            const key = template.checklist_template_id;
            const checked = values[key]?.status === 'DONE';
            return <div key={key} className={`px-4 py-5 sm:px-6 ${checked ? 'bg-emerald-50/40' : ''}`}>
              <label className='flex cursor-pointer items-start gap-3'>
                <input type='checkbox' disabled={busy} className='mt-0.5 h-5 w-5 shrink-0 accent-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600' checked={checked} onChange={(event) => setValue(key, 'status', event.target.checked ? 'DONE' : 'NOT_DONE')} />
                <span className={`min-w-0 break-words text-sm leading-6 ${checked ? 'text-emerald-900' : 'text-slate-700'}`}>{template.checklist_item}
                  {template.critical_flag === 'true' && <span className='ml-2 inline-block rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800'>Kritikal</span>}
                  {template.required_photo === 'true' && <span className='ml-2 inline-block text-xs font-medium text-slate-500'>Bukti foto wajib</span>}
                </span>
              </label>
              <details className='ml-8 mt-3'>
                <summary className='w-fit cursor-pointer rounded text-xs font-medium text-slate-500 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600'>Catatan &amp; bukti{values[key]?.notes || values[key]?.photo_url ? ' · terisi' : ''}</summary>
                <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                  <label className='text-xs font-medium text-slate-500'>Catatan<textarea rows={2} disabled={busy} aria-label={`Catatan ${template.checklist_item}`} className={control} placeholder='Kendala atau informasi tambahan' value={values[key]?.notes ?? ''} onChange={(event) => setValue(key, 'notes', event.target.value)} /></label>
                  <label className='text-xs font-medium text-slate-500'>Link foto {template.required_photo === 'true' ? '(wajib untuk DONE)' : '(opsional)'}<input disabled={busy} type='url' aria-label={`Foto ${template.checklist_item}`} className={control} placeholder='https://' value={values[key]?.photo_url ?? ''} onChange={(event) => setValue(key, 'photo_url', event.target.value)} /></label>
                </div>
              </details>
            </div>;
          })}
        </div>
      </section>;
    })}

    <div className='sticky bottom-3 z-10 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-5'>
      {error && <p role='alert' className='mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700'>{error}</p>}
      {success && <p role='status' className='mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800'>{success}</p>}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div><p className='text-sm font-medium text-slate-700'>{outlet?.outlet_name || 'Pilih outlet'} · {shifts.find((shift) => shift.shift_id === shiftId)?.shift_name || 'Pilih shift'}</p><p className='mt-1 text-xs leading-5 text-slate-500'>Item belum selesai tetap tercatat untuk ditinjau. Pendapatan melalui Moka/Finance.</p></div>
        <button disabled={busy || !selected.length || !outletId || !shiftId} onClick={submit} className='shrink-0 whitespace-nowrap rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500'>{busy ? 'Menyimpan…' : 'Simpan Closing'}</button>
      </div>
    </div>

    <section aria-label='Riwayat closing' className='pt-2'>
      <div className='mb-4 flex items-center justify-between'><h2 className='text-lg font-semibold tracking-tight text-slate-900'>Riwayat Closing</h2><span className='text-xs text-slate-500'>{rows.length} laporan</span></div>
      {rows.length === 0 ? <div className='rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500'>Belum ada riwayat closing.</div> : <div className='divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white'>
        {rows.slice().reverse().map((row) => <article key={row.closing_id} className='flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
          <div className='min-w-0'><p className='break-words text-sm font-medium text-slate-800'>{outlets.find((item) => item.outlet_id === row.outlet_id)?.outlet_name || row.outlet_id}</p><p className='mt-1 text-xs leading-5 text-slate-500'>{row.date} · {shifts.find((item) => item.shift_id === row.shift_id)?.shift_name || row.shift_id || 'Shift —'} · {row.closed_by || 'Petugas —'}</p></div>
          <span className={`w-fit shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${row.status === 'CLOSED' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{row.status === 'CLOSED' ? 'Selesai' : row.status === 'NEEDS_REVIEW' ? 'Perlu ditinjau' : row.status || 'Status —'}</span>
        </article>)}
      </div>}
    </section>
  </div>;
}
