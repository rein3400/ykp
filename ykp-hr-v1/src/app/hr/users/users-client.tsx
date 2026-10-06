'use client';
import { useState } from 'react';

const ROLES = [
  'owner', 'super_admin', 'hr_admin', 'finance_admin',
  'brand_manager', 'outlet_manager', 'supervisor', 'employee', 'viewer'
];

interface EmployeeOption {
  employee_id: string;
  full_name: string;
  outlet_id?: string;
}

export default function UsersClient({
  users, brands, outlets, employees
}: {
  users: Record<string, string>[];
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
  employees: EmployeeOption[];
}) {
  const [list, setList] = useState(users);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: '', password: '', role: 'employee', brand_id: '', outlet_id: '', employee_id: '', active_status: 'active'
  });

  const employeeLabel = (id: string) => {
    if (!id) return '—';
    const emp = employees.find((e) => e.employee_id === id);
    return emp ? `${emp.full_name} (${emp.employee_id})` : id;
  };

  async function create() {
    setErr(null);
    const r = await fetch('/api/hr/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([...list, j.data]);
    setShowForm(false);
    setForm({ username: '', password: '', role: 'employee', brand_id: '', outlet_id: '', employee_id: '', active_status: 'active' });
  }

  async function toggleActive(userId: string, current: string) {
    const next = current === 'active' ? 'inactive' : 'active';
    const r = await fetch('/api/hr/users', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, active_status: next })
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList(list.map((u) => u.user_id === userId ? j.data : u));
  }

  async function changeRole(userId: string, role: string) {
    // Dropdown role langsung tersimpan — konfirmasi dulu agar tidak terklik tak sengaja
    // (insiden: role akun owner sempat berubah jadi viewer).
    if (!window.confirm(`Ubah role user ${userId} menjadi "${role}"?`)) return;
    const r = await fetch('/api/hr/users', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role })
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList(list.map((u) => u.user_id === userId ? j.data : u));
  }

  async function changeEmployee(userId: string, employeeId: string) {
    const r = await fetch('/api/hr/users', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, employee_id: employeeId })
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList(list.map((u) => u.user_id === userId ? j.data : u));
  }

  return (
    <div className='space-y-3'>
      <button
        onClick={() => setShowForm(!showForm)}
        className='rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white'
      >
        {showForm ? 'Tutup' : '+ Tambah User'}
      </button>
      {err && <p className='text-xs text-red-600'>{err}</p>}
      {showForm && (
        <div className='rounded border border-slate-200 bg-white p-3 space-y-2'>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
            <input placeholder='Username *' value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className='rounded border px-2 py-1 text-xs' />
            <input placeholder='Password *' type='password' value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className='rounded border px-2 py-1 text-xs' />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className='rounded border px-2 py-1 text-xs'>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select aria-label='Karyawan' value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className='rounded border px-2 py-1 text-xs'>
              <option value=''>— Karyawan (untuk absen bot) —</option>
              {employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.full_name} ({e.employee_id})</option>)}
            </select>
            <select value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })} className='rounded border px-2 py-1 text-xs'>
              <option value=''>Semua Brand</option>
              {brands.map((b) => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
            </select>
            <select value={form.outlet_id} onChange={(e) => setForm({ ...form, outlet_id: e.target.value })} className='rounded border px-2 py-1 text-xs'>
              <option value=''>Semua Outlet</option>
              {outlets.filter((o) => ['active', '1'].includes((o.status ?? '').trim().toLowerCase())).map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
            </select>
          </div>
          <p className='text-[10px] text-slate-500'>
            Pilih <b>Karyawan</b> agar akun ini terhubung ke data absensi/payroll dan bisa absen via bot Telegram.
          </p>
          <button onClick={create} className='rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white'>Simpan</button>
        </div>
      )}
      <div className='overflow-x-auto rounded border border-slate-200'>
        <table className='w-full text-xs'>
          <thead className='bg-slate-50 text-slate-500'>
            <tr>
              <th className='px-2 py-1 text-left'>ID</th>
              <th className='px-2 py-1 text-left'>Username</th>
              <th className='px-2 py-1 text-left'>Role</th>
              <th className='px-2 py-1 text-left'>Karyawan</th>
              <th className='px-2 py-1 text-left'>Telegram</th>
              <th className='px-2 py-1 text-left'>Outlet</th>
              <th className='px-2 py-1 text-left'>Status</th>
              <th className='px-2 py-1 text-left'>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.user_id} className='border-t border-slate-100'>
                <td className='px-2 py-1 font-mono text-[10px]'>{u.user_id}</td>
                <td className='px-2 py-1 font-medium'>{u.username}</td>
                <td className='px-2 py-1'>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.user_id, e.target.value)}
                    className='rounded border px-1 py-0.5 text-[10px]'
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className='px-2 py-1'>
                  <select
                    value={u.employee_id || ''}
                    onChange={(e) => changeEmployee(u.user_id, e.target.value)}
                    className='max-w-44 rounded border px-1 py-0.5 text-[10px]'
                    title='Hubungkan akun ke data karyawan'
                  >
                    <option value=''>— belum terhubung —</option>
                    {employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.full_name} ({e.employee_id})</option>)}
                  </select>
                </td>
                <td className='px-2 py-1'>
                  {u.telegram_id
                    ? <span className='rounded bg-sky-100 px-1 text-[10px] font-medium text-sky-800'>✓ terhubung</span>
                    : <span className='rounded bg-slate-100 px-1 text-[10px] text-slate-600'>belum</span>}
                </td>
                <td className='px-2 py-1'>{outlets.find((o) => o.outlet_id === u.outlet_id)?.outlet_name || '—'}</td>
                <td className='px-2 py-1'>
                  <span className={`rounded px-1 text-[10px] font-medium ${
                    u.active_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>{u.active_status}</span>
                </td>
                <td className='px-2 py-1'>
                  <button
                    onClick={() => toggleActive(u.user_id, u.active_status)}
                    className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-slate-50'
                  >
                    {u.active_status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={8} className='px-2 py-3 text-center text-slate-500'>Belum ada user.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className='rounded border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-900'>
        <p className='font-semibold mb-1'>Cara menghubungkan karyawan ke Telegram:</p>
        <ol className='list-decimal pl-4 space-y-0.5'>
          <li>Pastikan kolom <b>Karyawan</b> sudah diisi (pilih nama karyawan).</li>
          <li>Karyawan login ke aplikasi HR dengan akun ini, lalu buka menu <b>Telegram</b>.</li>
          <li>Klik <b>Dapatkan Kode</b> → klik <b>Buka Telegram</b> → tekan <b>Start</b> di bot.</li>
          <li>Kolom <b>Telegram</b> di tabel ini berubah menjadi <b>✓ terhubung</b>.</li>
        </ol>
      </div>
      <div className='rounded border border-slate-200 p-3 text-[10px] text-slate-600'>
        <p className='font-semibold mb-1'>Permission checklist (revisi item 26):</p>
        <ul className='list-disc pl-4 space-y-0.5'>
          <li>Staff/employee tidak bisa melihat payroll orang lain</li>
          <li>Manager hanya melihat brand/outlet sendiri (scope filter)</li>
          <li>HR tidak bisa mengubah Finance</li>
          <li>Finance tidak bisa mengubah attendance</li>
          <li>Hanya owner/super_admin yang bisa assign role elevated</li>
        </ul>
      </div>
    </div>
  );
}
