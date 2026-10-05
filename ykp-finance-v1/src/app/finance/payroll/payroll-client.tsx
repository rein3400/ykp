'use client';
/**
 * Beban Gaji — total gaji yang harus dibayarkan + overview per cabang.
 * Read-only dari HR V1 payroll. Pilih periode untuk melihat angka bulan lain.
 */
import { useState } from 'react';
import { Card, Kpi, Th, Td, rp, EmptyState, Btn } from '../ui';
import type { PayrollOverview } from '@/lib/payroll-overview';
import { toast } from 'sonner';

export default function PayrollClient(props: {
  initial: PayrollOverview;
  periods: string[];
  brands: Record<string, string>[];
  role: string;
}) {
  const [period, setPeriod] = useState(props.periods[0] ?? '');
  const [data, setData] = useState(props.initial);
  const [loading, setLoading] = useState(false);
  const [notifyState, setNotifyState] = useState<{ kind: 'idle' | 'success' | 'error'; message: string }>({ kind: 'idle', message: '' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revisionFor, setRevisionFor] = useState<{ id: string; name: string } | null>(null);
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionError, setRevisionError] = useState('');

  async function loadPeriod(p: string) {
    setPeriod(p);
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/payroll-overview?period=${encodeURIComponent(p)}`);
      const j = await res.json();
      if (res.ok && j.data) setData(j.data);
    } finally {
      setLoading(false);
    }
  }

  async function markTransferred(id: string) {
    setBusyId(id);
    try {
      const r = await fetch('/api/finance/payroll/notify-hr', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payroll_period: period, payroll_ids: [id] })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message ?? `HTTP ${r.status}`);
      setData((d) => ({
        ...d,
        per_employee: d.per_employee.map((e) => (e.payroll_id === id ? { ...e, finance_notified: true } : e))
      }));
      toast.success('Ditandai sudah ditransfer — HR dinotifikasi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menandai transfer');
    } finally {
      setBusyId(null);
    }
  }

  async function submitRevision() {
    if (!revisionFor) return;
    if (revisionReason.trim().length < 5) {
      setRevisionError('Alasan revisi wajib diisi (minimal 5 karakter).');
      return;
    }
    setBusyId(revisionFor.id);
    try {
      const r = await fetch('/api/finance/payroll/needs-revision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payroll_id: revisionFor.id, reason: revisionReason.trim() })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message ?? `HTTP ${r.status}`);
      setData((d) => ({
        ...d,
        per_employee: d.per_employee.map((e) =>
          e.payroll_id === revisionFor.id
            ? { ...e, approval_status: 'NEEDS_REVISION', payable: false, needs_revision: true, needs_revision_reason: revisionReason.trim() }
            : e
        )
      }));
      toast.success('Revisi dikirim ke HR — baris terkunci sampai HR generate ulang');
      setRevisionFor(null);
      setRevisionReason('');
      setRevisionError('');
    } catch (e) {
      setRevisionError(e instanceof Error ? e.message : 'Gagal mengirim permintaan revisi');
    } finally {
      setBusyId(null);
    }
  }

  const t = data.totals;
  const sisaBayar = t.payable_total;

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Beban Gaji</h1>
          <p className='text-sm text-muted-foreground'>
            Gaji karyawan dari HR V1 (read-only). Import & pembayaran tetap dilakukan di aplikasi HR.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <label htmlFor='fin-payroll-period' className='text-xs text-muted-foreground'>Periode</label>
          <select
            id='fin-payroll-period'
            value={period}
            disabled={loading || props.periods.length === 0}
            onChange={(e) => void loadPeriod(e.target.value)}
            className='rounded border border-border bg-background px-2 py-1.5 text-xs'
          >
            {props.periods.length === 0 && <option value=''>—</option>}
            {props.periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <Btn
            variant='outline'
            disabled={!period || loading || notifyState.kind === 'success'}
            onClick={async () => {
              setNotifyState({ kind: 'idle', message: '' });
              try {
                const r = await fetch('/api/finance/payroll/notify-hr', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ payroll_period: period })
                });
                const j = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(j.error?.message ?? `HTTP ${r.status}`);
                setNotifyState({ kind: 'success', message: `Notifikasi terkirim ke HR — ${j.data?.updated ?? 0} payroll ditandai (periode ${period})` });
                toast.success('Notifikasi terkirim ke HR');
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'Gagal notifikasi HR';
                setNotifyState({ kind: 'error', message: `Gagal mengirim notifikasi untuk periode ${period}: ${msg}` });
                toast.error(msg);
              }
            }}
          >
            Sudah Transfer → Notif HR
          </Btn>
        </div>
      </div>

      {notifyState.kind === 'error' && (
        <div role='alert' className='flex items-start justify-between rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800'>
          <span>⚠ {notifyState.message}</span>
          <button type='button' onClick={() => setNotifyState({ kind: 'idle', message: '' })} className='ml-3 text-xs text-red-600 underline'>tutup</button>
        </div>
      )}
      {notifyState.kind === 'success' && (
        <div role='status' className='flex items-start justify-between rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800'>
          <span>✓ {notifyState.message} — HR dapat memproses approve di aplikasi HR.</span>
          <button type='button' onClick={() => setNotifyState({ kind: 'idle', message: '' })} className='ml-3 text-xs text-green-700 underline'>tutup</button>
        </div>
      )}

      {props.periods.length === 0 ? (
        <EmptyState message='Belum ada data payroll dari HR V1. Generate payroll di aplikasi HR terlebih dahulu.' />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
            <Kpi label='HARUS DIBAYAR' value={rp(sisaBayar)} sub={`${t.payable_count} karyawan (belum PAID)`} />
            <Kpi label='SUDAH DIBAYAR' value={rp(t.paid_total)} sub='status PAID' />
            <Kpi label='GROSS / NET TOTAL' value={rp(t.gross_total)} sub={`net ${rp(t.net_total)}`} />
            <Kpi label='KARYAWAN' value={String(t.employee_count)} sub={`periode ${t.period || 'semua'}`} />
          </div>

          <Card title='Rincian per Karyawan' sub={`${data.per_employee.length} karyawan — nominal gaji yang harus dibayarkan`}>
            {data.per_employee.length === 0 ? (
              <p className='p-3 text-xs text-muted-foreground'>Tidak ada data.</p>
            ) : (
              <div className='overflow-x-auto'>
                <table className='w-full text-xs'>
                  <thead className='bg-muted text-muted-foreground'>
                    <tr>
                      <Th>Karyawan</Th>
                      <Th>Cabang</Th>
                      <Th right>Gross</Th>
                      <Th>No Rekening</Th>
                      <Th right>Net</Th>
                      <Th>Status</Th>
                      <Th>Email Slip</Th>
                      <Th>Aksi</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.per_employee.map((e) => (
                      <tr key={e.payroll_id} className='border-t border-border'>
                        <Td bold>{e.employee_name}<span className='ml-1 text-[10px] text-muted-foreground'>{e.employee_id}</span></Td>
                        <Td>{e.brand_name}</Td>
                        <Td>
                          {e.bank_account ? (
                            <span className='font-mono text-[10px]'>
                              {e.bank_name} · {e.bank_account}
                              <span className='block text-muted-foreground'>{e.account_holder || e.employee_name}</span>
                            </span>
                          ) : (
                            <span className='text-[10px] text-muted-foreground'>— belum diisi di HR</span>
                          )}
                        </Td>
                        <Td right muted>{rp(e.gross)}</Td>
                        <Td right bold>{rp(e.net)}</Td>
                        <Td>
                          <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${e.needs_revision ? 'bg-red-100 text-red-700' : e.paid ? 'bg-green-100 text-green-700' : e.payable ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`} title={e.needs_revision_reason || undefined}>
                            {e.needs_revision ? '🔒 MENUNGGU REVISI HR' : e.paid ? 'SUDAH DIBAYAR' : e.payable ? 'HARUS DIBAYAR' : e.finance_notified ? 'SUDAH DITRANSFER' : e.approval_status}
                          </span>
                          {e.needs_revision && e.needs_revision_reason ? (
                            <div className='mt-0.5 max-w-52 text-[10px] text-red-700'>Revisi: {e.needs_revision_reason}</div>
                          ) : null}
                        </Td>
                        <Td muted>{e.email_sent_status ? e.email_sent_status : e.payable ? 'akan dari ' + (props.brands.find((b) => b.brand_id === e.brand_id)?.email ?? '-') : '-'}</Td>
                        <Td>
                          {e.needs_revision ? (
                            <span className='text-[10px] text-muted-foreground'>terkunci — menunggu HR</span>
                          ) : e.paid ? (
                            <span className='text-[10px] text-muted-foreground'>selesai</span>
                          ) : !e.ready_for_finance ? (
                            <span className='text-[10px] text-muted-foreground'>menunggu approve HR — baris legacy sebelum auto-approve Generate</span>
                          ) : (
                            <div className='flex flex-wrap gap-1'>
                              <button
                                type='button'
                                disabled={busyId !== null || e.finance_notified}
                                onClick={() => void markTransferred(e.payroll_id)}
                                className='rounded border border-border px-2 py-0.5 text-[10px] hover:bg-muted disabled:opacity-50'
                                title='Tandai baris ini sudah ditransfer & notifikasi HR'
                              >
                                {e.finance_notified ? '✓ ditransfer' : 'Tandai ditransfer'}
                              </button>
                              <button
                                type='button'
                                disabled={busyId !== null}
                                onClick={() => { setRevisionFor({ id: e.payroll_id, name: e.employee_name }); setRevisionReason(''); setRevisionError(''); }}
                                className='rounded border border-red-300 px-2 py-0.5 text-[10px] text-red-700 hover:bg-red-50 disabled:opacity-50'
                                title='Minta HR memperbaiki nominal (wajib isi alasan)'
                              >
                                Minta Revisi
                              </button>
                            </div>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title='Beban Gaji per Cabang' sub={`${data.per_branch.length} cabang — diurut dari beban terbesar — email pengirim slip per brand`}>
            {data.per_branch.length === 0 ? (
              <p className='p-3 text-xs text-muted-foreground'>Tidak ada data pada filter ini.</p>
            ) : (
              <div className='overflow-x-auto'>
                <table className='w-full text-xs'>
                  <thead className='bg-muted text-muted-foreground'>
                    <tr>
                      <Th>Cabang</Th>
                      <Th>Email Cabang</Th>
                      <Th right>Karyawan</Th>
                      <Th right>Gross</Th>
                      <Th right>Net</Th>
                      <Th right>Harus Dibayar</Th>
                      <Th right>Sudah Dibayar</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.per_branch.map((b) => {
                      const brandRec = props.brands.find((x) => x.brand_id === b.brand_id);
                      return (
                        <tr key={b.brand_id} className='border-t border-border'>
                          <Td bold>{b.brand_name}</Td>
                          <Td muted>{brandRec?.email ?? '-'}</Td>
                          <Td right>{b.employee_count}</Td>
                          <Td right muted>{rp(b.gross_total)}</Td>
                          <Td right>{rp(b.net_total)}</Td>
                          <Td right bold>{rp(b.payable_total)}</Td>
                          <Td right muted>{rp(b.paid_total)}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {revisionFor && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4' role='dialog' aria-modal='true'>
          <div className='w-full max-w-md space-y-3 rounded-lg bg-background p-4 shadow-xl'>
            <div>
              <h2 className='text-base font-semibold'>Minta Revisi Payroll</h2>
              <p className='text-xs text-muted-foreground'>
                {revisionFor.name} ({revisionFor.id}) — antrean terkunci selama masa revisi; HR akan memperbaiki lalu generate ulang.
              </p>
            </div>
            <label className='block text-sm font-medium'>
              Catatan alasan revisi (wajib)
              <textarea
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                rows={3}
                autoFocus
                className='mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm'
                placeholder='Mis: nominal lembur salah, cek ulang data presensi lembur'
              />
            </label>
            {revisionError && <div className='text-xs text-red-600'>{revisionError}</div>}
            <div className='flex justify-end gap-2'>
              <button
                type='button'
                disabled={busyId !== null}
                onClick={() => { setRevisionFor(null); setRevisionReason(''); setRevisionError(''); }}
                className='rounded border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50'
              >
                Batal
              </button>
              <button
                type='button'
                disabled={busyId !== null || revisionReason.trim().length < 5}
                onClick={() => void submitRevision()}
                className='rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50'
                title='Kirim permintaan revisi ke HR (wajib alasan, minimal 5 karakter)'
              >
                {busyId ? 'Mengirim…' : 'Kirim Revisi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}