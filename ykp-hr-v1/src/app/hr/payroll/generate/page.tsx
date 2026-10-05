'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const currentPeriod = new Date().toISOString().slice(0, 7);

export default function GeneratePayrollPage() {
  const router = useRouter();
  const [period, setPeriod] = useState(currentPeriod);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ count: number } | null>(null);

  async function run() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const r = await fetch('/api/hr/payroll/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? 'Gagal generate');
      setResult({ count: j.data?.count ?? 0 });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='space-y-4'>
      <h1 className='text-2xl font-bold'>Generate Payroll</h1>
      <div className='card max-w-md space-y-3'>
        <label className='text-sm'>
          Periode (YYYY-MM)
          <input type='month' className='input mt-1 w-full' value={period} onChange={(e) => setPeriod(e.target.value)} />
        </label>
        <p className='text-xs text-muted-foreground'>
          Satu klik: Generate membuat payroll semua karyawan aktif, menarik presensi/lembur dan komponen manual yang sudah disetujui (bonus, insentif, penalti, tunjangan, kasbon, potongan lain), lalu langsung MENGUNCI data (lock otomatis) dan menandai READY_TO_PAY — baris langsung terlihat di antrean Finance sebagai HARUS DIBAYAR tanpa tombol approve tambahan. Setelah Finance transfer, HR validasi pembayaran untuk mengirim slip gaji. Re-generate: baris yang sudah terkunci (LOCKED/PAID) tidak bisa dihitung ulang selama masih ada baris LOCKED di periode itu — owner/super_admin harus Unlock dulu dengan alasan; baris NEEDS_REVISION ikut dihitung ulang dan dikunci kembali.
        </p>
        {error && <div className='text-sm text-red-600'>{error}</div>}
        {result && <div className='text-sm text-green-700'>Generated {result.count} payroll rows.</div>}
        <button onClick={run} disabled={busy} className='btn-primary'>
          {busy ? 'Menghitung...' : 'Generate'}
        </button>
      </div>
    </div>
  );
}