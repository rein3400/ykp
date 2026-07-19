'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = Record<string, string>;

const inputCls = 'w-full rounded border border-border px-2 py-1.5 text-xs';
const labelCls = 'mb-1 block text-[10px] font-medium uppercase text-muted-foreground';
const DEPTS = ['KITCHEN', 'FOH', 'CASHIER', 'BAR', 'STORAGE', 'GENERAL'];

export default function SettingsClient({ thresholds, templates, incidentTypes, outlets, role }: {
  thresholds: Row[]; templates: Row[]; incidentTypes: Row[]; outlets: Row[]; role: string;
}) {
  const router = useRouter();
  const canEdit = ['owner', 'super_admin'].includes(role);
  const [tab, setTab] = useState<'threshold' | 'template' | 'incident'>('threshold');
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [showTplForm, setShowTplForm] = useState(false);
  const [tpl, setTpl] = useState({
    checklist_type: 'OPENING', department: 'KITCHEN', checklist_item: '',
    checklist_category: '', required_photo: 'NO', target_value: '', tolerance_value: '',
    unit: '', critical_flag: 'NO'
  });

  async function saveThreshold(id: string, value: string) {
    setLoading(id);
    setErr(null);
    setOk(null);
    try {
      const r = await fetch('/api/ops/settings/threshold', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold_id: id, value })
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? 'Gagal update threshold'); return; }
      setOk('Threshold tersimpan');
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function createTemplate() {
    setLoading('tpl');
    setErr(null);
    try {
      const r = await fetch('/api/ops/settings/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tpl)
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? 'Gagal membuat template'); return; }
      setShowTplForm(false);
      setTpl({ ...tpl, checklist_item: '', checklist_category: '', target_value: '', tolerance_value: '', unit: '' });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function toggleTemplate(id: string, active: boolean) {
    setLoading(id);
    setErr(null);
    try {
      const r = await fetch('/api/ops/settings/template', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist_template_id: id, active_status: active ? 'active' : 'inactive' })
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? 'Gagal update template'); return; }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className='space-y-3'>
      <div className='flex gap-1 border-b border-border'>
        {([['threshold', 'Threshold Config'], ['template', 'Checklist Template'], ['incident', 'Incident Types']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'}`}>
            {l}
          </button>
        ))}
      </div>
      {err && <p className='text-xs text-destructive'>{err}</p>}
      {ok && <p className='text-xs text-success'>{ok}</p>}
      {!canEdit && <p className='text-xs text-muted-foreground'>Mode lihat ΓÇö edit threshold/template membutuhkan owner atau super_admin.</p>}

      {tab === 'threshold' && (
        <div className='overflow-x-auto rounded border border-border'>
          <table className='w-full text-xs'>
            <thead className='bg-muted text-muted-foreground'>
              <tr>
                <th className='px-2 py-1 text-left'>Key</th>
                <th className='px-2 py-1 text-left'>Nama</th>
                <th className='px-2 py-1 text-left'>Penjelasan</th>
                <th className='px-2 py-1 text-right'>Value</th>
                <th className='px-2 py-1 text-center'>Unit</th>
                <th className='px-2 py-1 text-center'>Severity</th>
                <th className='px-2 py-1 text-left'>Terakhir Diubah</th>
                {canEdit && <th className='px-2 py-1'></th>}
              </tr>
            </thead>
            <tbody>
              {thresholds.map((t) => (
                <tr key={t.threshold_id} className='border-t border-border'>
                  <td className='px-2 py-1 font-mono text-[10px]'>{t.threshold_key}</td>
                  <td className='px-2 py-1'>{t.threshold_name}</td>
                  <td className='px-2 py-1 max-w-xs text-muted-foreground'>{t.explanation}</td>
                  <td className='px-2 py-1 text-right'>
                    {canEdit ? (
                      <input
                        defaultValue={t.value}
                        onBlur={(e) => { if (e.target.value !== t.value) saveThreshold(t.threshold_id, e.target.value); }}
                        className='w-24 rounded border border-border px-1.5 py-0.5 text-right text-xs'
                      />
                    ) : <b>{t.value}</b>}
                  </td>
                  <td className='px-2 py-1 text-center'>{t.unit}</td>
                  <td className='px-2 py-1 text-center'>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      t.severity === 'HIGH' ? 'bg-warning text-white'
                      : t.severity === 'CRITICAL' ? 'bg-destructive text-destructive-foreground'
                      : 'bg-primary text-primary-foreground'
                    }`}>{t.severity}</span>
                  </td>
                  <td className='px-2 py-1 text-muted-foreground'>{t.last_changed_at} oleh {t.changed_by}</td>
                  {canEdit && <td className='px-2 py-1 text-right'>{loading === t.threshold_id && 'ΓÇª'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'template' && (
        <div className='space-y-2'>
          {canEdit && (
            <button onClick={() => setShowTplForm((v) => !v)} className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>
              {showTplForm ? 'Tutup Form' : '+ Tambah Template'}
            </button>
          )}
          {showTplForm && (
            <div className='rounded border border-border p-3 grid grid-cols-2 gap-2 md:grid-cols-5'>
              <div>
                <label className={labelCls}>Tipe</label>
                <select className={inputCls} value={tpl.checklist_type} onChange={(e) => setTpl({ ...tpl, checklist_type: e.target.value })}>
                  <option value='OPENING'>OPENING</option>
                  <option value='CLOSING'>CLOSING</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Department</label>
                <select className={inputCls} value={tpl.department} onChange={(e) => setTpl({ ...tpl, department: e.target.value })}>
                  {DEPTS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Item</label>
                <input className={inputCls} value={tpl.checklist_item} onChange={(e) => setTpl({ ...tpl, checklist_item: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Kategori</label>
                <input className={inputCls} value={tpl.checklist_category} onChange={(e) => setTpl({ ...tpl, checklist_category: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Critical?</label>
                <select className={inputCls} value={tpl.critical_flag} onChange={(e) => setTpl({ ...tpl, critical_flag: e.target.value })}>
                  <option value='NO'>NO</option>
                  <option value='YES'>YES</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Foto Wajib?</label>
                <select className={inputCls} value={tpl.required_photo} onChange={(e) => setTpl({ ...tpl, required_photo: e.target.value })}>
                  <option value='NO'>NO</option>
                  <option value='YES'>YES</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Target</label>
                <input className={inputCls} value={tpl.target_value} onChange={(e) => setTpl({ ...tpl, target_value: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Toleransi</label>
                <input className={inputCls} value={tpl.tolerance_value} onChange={(e) => setTpl({ ...tpl, tolerance_value: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Unit</label>
                <input className={inputCls} value={tpl.unit} onChange={(e) => setTpl({ ...tpl, unit: e.target.value })} />
              </div>
              <div className='flex items-end'>
                <button onClick={createTemplate} disabled={loading === 'tpl' || !tpl.checklist_item}
                  className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50'>
                  {loading === 'tpl' ? 'MenyimpanΓÇª' : 'Simpan'}
                </button>
              </div>
            </div>
          )}
          <div className='overflow-x-auto rounded border border-border'>
            <table className='w-full text-xs'>
              <thead className='bg-muted text-muted-foreground'>
                <tr>
                  <th className='px-2 py-1 text-left'>Tipe</th>
                  <th className='px-2 py-1 text-left'>Dept</th>
                  <th className='px-2 py-1 text-left'>Item</th>
                  <th className='px-2 py-1 text-center'>Foto</th>
                  <th className='px-2 py-1 text-right'>Target ┬▒ Tol</th>
                  <th className='px-2 py-1 text-center'>Critical</th>
                  <th className='px-2 py-1 text-center'>Status</th>
                  {canEdit && <th className='px-2 py-1'></th>}
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.checklist_template_id} className='border-t border-border'>
                    <td className='px-2 py-1'>{t.checklist_type}</td>
                    <td className='px-2 py-1'>{t.department}</td>
                    <td className='px-2 py-1'>{t.checklist_item}</td>
                    <td className='px-2 py-1 text-center'>{t.required_photo === 'YES' ? '≡ƒô╖' : 'ΓÇö'}</td>
                    <td className='px-2 py-1 text-right'>{t.target_value ? `${t.target_value}${t.tolerance_value ? ` ┬▒${t.tolerance_value}` : ''} ${t.unit}` : 'ΓÇö'}</td>
                    <td className='px-2 py-1 text-center'>
                      {t.critical_flag === 'YES' && <span className='rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive'>CRITICAL</span>}
                    </td>
                    <td className='px-2 py-1 text-center'>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${t.active_status === 'active' ? 'bg-success text-white' : 'bg-muted text-muted-foreground'}`}>
                        {t.active_status}
                      </span>
                    </td>
                    {canEdit && (
                      <td className='px-2 py-1 text-right'>
                        <button onClick={() => toggleTemplate(t.checklist_template_id, t.active_status !== 'active')} disabled={loading === t.checklist_template_id}
                          className='rounded border border-border px-2 py-0.5 text-[10px] hover:bg-muted disabled:opacity-50'>
                          {t.active_status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'incident' && (
        <div className='overflow-x-auto rounded border border-border'>
          <table className='w-full text-xs'>
            <thead className='bg-muted text-muted-foreground'>
              <tr>
                <th className='px-2 py-1 text-left'>Tipe</th>
                <th className='px-2 py-1 text-center'>Default Severity</th>
                <th className='px-2 py-1 text-left'>Escalation Rule</th>
                <th className='px-2 py-1 text-center'>Food Safety</th>
              </tr>
            </thead>
            <tbody>
              {incidentTypes.map((t) => (
                <tr key={t.incident_type_id} className='border-t border-border'>
                  <td className='px-2 py-1 font-medium'>{t.incident_type_name}</td>
                  <td className='px-2 py-1 text-center'>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      t.default_severity === 'CRITICAL' ? 'bg-destructive text-destructive-foreground'
                      : t.default_severity === 'HIGH' ? 'bg-warning text-white'
                      : 'bg-primary text-primary-foreground'
                    }`}>{t.default_severity}</span>
                  </td>
                  <td className='px-2 py-1 text-muted-foreground'>{t.escalation_rule}</td>
                  <td className='px-2 py-1 text-center'>{t.food_safety_flag === 'YES' ? 'ΓÜá' : 'ΓÇö'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {outlets.length === 0 && <p className='text-xs text-muted-foreground'>Tidak ada outlet aktif.</p>}
    </div>
  );
}
