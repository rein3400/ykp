'use client';

import { useState } from 'react';

export default function ShiftsClient({
  shifts,
}: {
  shifts: Record<string, string>[];
}) {
  const [list, setList] = useState(shifts);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const emptyForm = { shift_name: '', start_time: '', end_time: '', break_minutes: '60', late_tolerance_minutes: '10' };
  const [form, setForm] = useState(emptyForm);

  function reset() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    setErr('');
  }

  async function save() {
    setErr('');
    setBusy(true);
    try {
      const isEdit = editId !== null;
      const body = isEdit ? { shift_id: editId, ...form } : form;
      const r = await fetch('/api/hr/shifts', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await r.json();
      if (!r.ok) { setErr(j?.error?.message ?? 'Gagal menyimpan'); return; }
      if (isEdit) {
        setList(list.map((s) => (s.shift_id === editId ? j.data : s)));
      } else {
        setList([...list, j.data]);
      }
      reset();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(s: Record<string, string>) {
    setEditId(s.shift_id);
    setShowForm(true);
    setErr('');
    setForm({
      shift_name: s.shift_name || '',
      start_time: s.start_time || '',
      end_time: s.end_time || '',
      break_minutes: s.break_minutes || '60',
      late_tolerance_minutes: s.late_tolerance_minutes || '10'
    });
  }

  async function toggleActive(s: Record<string, string>) {
    setErr('');
    const next = s.active_status === 'active' ? 'inactive' : 'active';
    const r = await fetch('/api/hr/shifts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: s.shift_id, active_status: next })
    });
    const j = await r.json();
    if (!r.ok) { setErr(j?.error?.message ?? 'Gagal'); return; }
    setList(list.map((x) => (x.shift_id === s.shift_id ? j.data : x)));
  }

  return (
    <div className='space-y-3'>
      <button
        onClick={() => { reset(); setShowForm(true); }}
        className='rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white'
      >
        + Tambah Shift
      </button>

      {err && <p className='text-xs text-red-600'>{err}</p>}

      {showForm && (
        <div className='rounded border border-slate-200 bg-white p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-6'>
            <input
              placeholder='Nama Shift * (mis. Reguler Shift 1)'
              value={form.shift_name}
              onChange={(e) => setForm({ ...form, shift_name: e.target.value })}
              className='rounded border px-2 py-1 text-xs md:col-span-2'
            />
            <label className='text-[10px] text-slate-500'>
              Mulai *
              <input
                type='time'
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className='w-full rounded border px-2 py-1 text-xs'
                required
              />
            </label>
            <label className='text-[10px] text-slate-500'>
              Selesai *
              <input
                type='time'
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className='w-full rounded border px-2 py-1 text-xs'
                required
              />
            </label>
            <label className='text-[10px] text-slate-500'>
              Istirahat (menit)
              <input
                type='number'
                value={form.break_minutes}
                onChange={(e) => setForm({ ...form, break_minutes: e.target.value })}
                className='w-full rounded border px-2 py-1 text-xs'
              />
            </label>
            <label className='text-[10px] text-slate-500'>
              Toleransi telat (menit)
              <input
                type='number'
                value={form.late_tolerance_minutes}
                onChange={(e) => setForm({ ...form, late_tolerance_minutes: e.target.value })}
                className='w-full rounded border px-2 py-1 text-xs'
              />
            </label>
          </div>
          <div className='flex gap-2'>
            <button onClick={save} disabled={busy} className='rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50'>
              {busy ? 'Menyimpan…' : editId ? 'Simpan Perubahan' : 'Simpan Shift'}
            </button>
            <button onClick={reset} className='rounded border px-3 py-1 text-xs'>Batal</button>
          </div>
          <p className='text-[10px] text-slate-400'>Format 24 jam. Shift lintas tengah malam (mis. 20:00–04:00) belum didukung.</p>
        </div>
      )}

      <div className='overflow-x-auto rounded border border-slate-200'>
        <table className='w-full text-xs'>
          <thead className='bg-slate-50 text-slate-500'>
            <tr>
              <th className='px-2 py-1 text-left'>Kode</th>
              <th className='px-2 py-1 text-left'>Nama Shift</th>
              <th className='px-2 py-1 text-left'>Jam</th>
              <th className='px-2 py-1 text-left'>Istirahat</th>
              <th className='px-2 py-1 text-left'>Toleransi Telat</th>
              <th className='px-2 py-1 text-left'>Status</th>
              <th className='px-2 py-1 text-left'>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.shift_id} className='border-t border-slate-100'>
                <td className='px-2 py-1 font-mono text-[10px]'>{s.shift_id}</td>
                <td className='px-2 py-1 font-medium'>{s.shift_name}</td>
                <td className='px-2 py-1'>{s.start_time} – {s.end_time}</td>
                <td className='px-2 py-1'>{s.break_minutes} mnt</td>
                <td className='px-2 py-1'>{s.late_tolerance_minutes} mnt</td>
                <td className='px-2 py-1'>
                  <span className={`rounded px-1 text-[10px] font-medium ${
                    (s.active_status ?? 'active') === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {(s.active_status ?? 'active') === 'active' ? 'aktif' : 'nonaktif'}
                  </span>
                </td>
                <td className='px-2 py-1 space-x-1'>
                  <button onClick={() => startEdit(s)} className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-slate-50'>Edit Jam</button>
                  <button
                    onClick={() => toggleActive(s)}
                    className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-slate-50'
                  >
                    {(s.active_status ?? 'active') === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7} className='px-2 py-3 text-center text-slate-400'>Belum ada shift.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className='text-[10px] text-slate-400'>
        Tips: gunakan nama yang membedakan jenisnya — contoh: <b>Reguler Shift 1</b> (Senin–Jumat), <b>Weekend Kasir Shift 1</b>, <b>Weekend Kitchen Shift 0</b>.
      </p>
    </div>
  );
}