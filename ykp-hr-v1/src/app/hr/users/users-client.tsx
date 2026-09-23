'use client';
import { useState } from 'react';

const ROLES = [
  'owner', 'super_admin', 'hr_admin', 'finance_admin',
  'brand_manager', 'outlet_manager', 'supervisor', 'employee', 'viewer'
];

export default function UsersClient({
  users, brands, outlets
}: {
  users: Record<string, string>[];
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
}) {
  const [list, setList] = useState(users);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: '', password: '', role: 'viewer', brand_id: '', outlet_id: '', active_status: 'active'
  });

  async function create() {
    setErr(null);
    const r = await fetch('/api/hr/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error?.message ?? 'Gagal'); return; }
    setList([...list, j.data]);
    setShowForm(false);
    setForm({ username: '', password: '', role: 'viewer', brand_id: '', outlet_id: '', active_status: 'active' });
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
    const r = await fetch('/api/hr/users', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role })
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
            <select value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })} className='rounded border px-2 py-1 text-xs'>
              <option value=''>Semua Brand</option>
              {brands.map((b) => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
            </select>
            <select value={form.outlet_id} onChange={(e) => setForm({ ...form, outlet_id: e.target.value })} className='rounded border px-2 py-1 text-xs'>
              <option value=''>Semua Outlet</option>
              {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
            </select>
          </div>
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
              <th className='px-2 py-1 text-left'>Brand</th>
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
                <td className='px-2 py-1'>{brands.find((b) => b.brand_id === u.brand_id)?.brand_name || '—'}</td>
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
              <tr><td colSpan={7} className='px-2 py-3 text-center text-slate-500'>Belum ada user.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className='rounded border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-900'>
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
