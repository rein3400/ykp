'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { selectChecklistTemplates } from '@/lib/checklist';

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
  const outlet = outlets.find((row) => row.outlet_id === outletId);
  const selected = selectChecklistTemplates(templates, 'CLOSING', outletId, outlet?.brand_id ?? '');
  function setValue(key: string, field: string, value: string) {
    setValues((previous) => ({ ...previous, [key]: { ...previous[key], [field]: value } }));
  }
  async function submit() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/ops/closing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        outlet_id: outletId, shift_id: shiftId, date,
        items: selected.map((template) => ({ checklist_item: template.checklist_item, status: values[template.checklist_template_id]?.status ?? 'NOT_DONE', notes: values[template.checklist_template_id]?.notes ?? '', photo_url: values[template.checklist_template_id]?.photo_url ?? '' }))
      }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error?.message ?? 'Gagal menyimpan'); return; }
      setValues({}); router.refresh();
    } catch { setError('Gagal menghubungi server; periksa riwayat sebelum mengirim ulang.'); }
    finally { setBusy(false); }
  }
  return <div className='space-y-4'>
    <div className='rounded border p-4 space-y-3'>
      <h2 className='font-semibold'>Checklist Closing · {date} WIB</h2>
      <p className='text-xs'>Pendapatan dicatat melalui Moka/Finance, bukan formulir ini.</p>
      <select aria-label='Outlet' value={outletId} onChange={(event) => { setOutletId(event.target.value); setValues({}); }}>
        {outlets.map((row) => <option key={row.outlet_id} value={row.outlet_id}>{row.outlet_name} ({row.outlet_id})</option>)}
      </select>
      <select aria-label='Shift' value={shiftId} onChange={(event) => setShiftId(event.target.value)}>
        {shifts.map((row) => <option key={row.shift_id} value={row.shift_id}>{row.shift_name}</option>)}
      </select>
      {selected.length === 0 && <p>Tidak ada template CLOSING untuk outlet ini. Konfigurasikan template terlebih dahulu.</p>}
      {selected.map((template) => <div className='rounded border p-3 space-y-2' key={template.checklist_template_id}>
        <p className='text-xs'>{template.department || 'Umum'}</p>
        <label><input type='checkbox' checked={values[template.checklist_template_id]?.status === 'DONE'} onChange={(event) => setValue(template.checklist_template_id, 'status', event.target.checked ? 'DONE' : 'NOT_DONE')} /> {template.checklist_item} {template.critical_flag === 'true' ? '(KRITIKAL)' : ''}</label>
        <input aria-label={`Catatan ${template.checklist_item}`} placeholder='Catatan' value={values[template.checklist_template_id]?.notes ?? ''} onChange={(event) => setValue(template.checklist_template_id, 'notes', event.target.value)} />
        <input aria-label={`Foto ${template.checklist_item}`} placeholder={template.required_photo === 'true' ? 'Link foto HTTPS wajib untuk DONE' : 'Link foto HTTPS'} value={values[template.checklist_template_id]?.photo_url ?? ''} onChange={(event) => setValue(template.checklist_template_id, 'photo_url', event.target.value)} />
      </div>)}
      {error && <p role='alert'>{error}</p>}
      <button disabled={busy || !selected.length || !outletId || !shiftId} onClick={submit}>{busy ? 'Menyimpan…' : 'Submit Closing'}</button>
    </div>
    <h2>Riwayat Closing</h2>
    {rows.slice().reverse().map((row) => <p key={row.closing_id}>{row.date} · {row.outlet_id} · {row.status} · {row.closed_by}</p>)}
  </div>;
}
