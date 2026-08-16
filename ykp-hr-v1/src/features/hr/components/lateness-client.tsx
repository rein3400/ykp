'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/status-badge';

type Row = {
  lateness_id: string;
  date: string;
  employee_id: string;
  employee_name: string;
  late_minutes: string;
  tolerance_minutes: string;
  payable_late_minutes: string;
  penalty_amount: string;
  approval_status: string;
  approved_by?: string;
};

export function LatenessClient({ initial }: { initial: Row[] }) {
  const router = useRouter();
  // Keep client state in sync when server re-fetches after router.refresh().
  const [rows, setRows] = useState<Row[]>(initial);
  useEffect(() => {
    setRows(initial);
  }, [initial]);
  const [busy, setBusy] = useState(false);

  async function decide(id: string, decision: 'APPROVE' | 'REJECT') {
    setBusy(true);
    try {
      const res = await fetch('/api/hr/lateness/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lateness_id: id, decision }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setRows((rs) =>
        rs.map((r) =>
          r.lateness_id === id
            ? {
                ...r,
                approval_status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
                approved_by: 'owner',
              }
            : r
        )
      );
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='card'>
      <h2 className='mb-3 font-semibold'>Daftar Keterlambatan</h2>
      {rows.length === 0 ? (
        <p className='text-sm text-slate-500'>Belum ada baris keterlambatan.</p>
      ) : (
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-slate-200 text-sm'>
            <thead className='bg-slate-50'>
              <tr>
                <th className='px-3 py-2 text-left'>Tanggal</th>
                <th className='px-3 py-2 text-left'>Karyawan</th>
                <th className='px-3 py-2 text-right'>Telat (m)</th>
                <th className='px-3 py-2 text-right'>Denda</th>
                <th className='px-3 py-2 text-left'>Status</th>
                <th className='px-3 py-2 text-right'>Aksi</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100'>
              {rows.map((r) => (
                <tr key={r.lateness_id} className='hover:bg-slate-50'>
                  <td className='px-3 py-2'>{r.date}</td>
                  <td className='px-3 py-2'>{r.employee_name || r.employee_id}</td>
                  <td className='px-3 py-2 text-right'>{r.late_minutes}</td>
                  <td className='px-3 py-2 text-right'>{r.penalty_amount}</td>
                  <td className='px-3 py-2'>
                    <StatusBadge status={r.approval_status || 'PENDING'} />
                  </td>
                  <td className='px-3 py-2 text-right'>
                    {r.approval_status === 'PENDING' && (
                      <div className='flex justify-end gap-2'>
                        <button
                          onClick={() => decide(r.lateness_id, 'APPROVE')}
                          disabled={busy}
                          className='rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50'
                        >
                          Setujui
                        </button>
                        <button
                          onClick={() => decide(r.lateness_id, 'REJECT')}
                          disabled={busy}
                          className='rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50'
                        >
                          Tolak
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
