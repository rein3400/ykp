'use client';
/**
 * Laporan Harian (fin_daily_summary) — kontrak Hermez (blueprint §9.2).
 * Viewer + regenerate (finance_admin+). Regenerate juga menjalankan finance
 * alert rules dan auto-create action tracker untuk HIGH/CRITICAL.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { todayWib } from '@/lib/wib';
import { can, type Role } from '@/lib/rbac';
import { Card, EmptyState, Btn, Th, Td, Badge, Input, Select, rp, rpSigned } from '../ui';

export default function SummaryClient(props: {
  summaries: Record<string, string>[];
  outlets: Record<string, string>[];
  alerts: Record<string, string>[];
  role: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(todayWib());
  const [outletId, setOutletId] = useState('');
  const [busy, setBusy] = useState(false);
  const canGenerate = can(props.role as Role, 'generate', 'summary');

  const availableDates = useMemo(
    () => [...new Set(props.summaries.map((s) => s.date))].sort().reverse(),
    [props.summaries]
  );
  const effectiveDate = availableDates.includes(date) ? date : availableDates[0] ?? date;

  const rows = useMemo(() => props.summaries
    .filter((r) => r.date === effectiveDate && (!outletId || r.outlet_id === outletId))
    .sort((a, b) => a.outlet_id.localeCompare(b.outlet_id)),
  [props.summaries, effectiveDate, outletId]);

  const dayAlerts = useMemo(() => props.alerts.filter((a) => a.date === effectiveDate), [props.alerts, effectiveDate]);

  const group = useMemo(() => rows.reduce((acc, r) => ({
    net: acc.net + Number(r.net_sales || 0),
    expense: acc.expense + Number(r.total_expense || 0),
    supplier: acc.supplier + Number(r.supplier_cost || 0),
    petty: acc.petty + Number(r.petty_cash_out || 0),
    surplus: acc.surplus + Number(r.estimated_surplus || 0),
    unpaid: acc.unpaid + Number(r.unpaid_supplier || 0)
  }), { net: 0, expense: 0, supplier: 0, petty: 0, surplus: 0, unpaid: 0 }), [rows]);

  async function regenerate() {
    setBusy(true);
    try {
      const r = await fetch('/api/finance/summary/regenerate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, outlet_id: outletId || undefined })
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal regenerate'); return; }
      toast.success(`Summary ${j.data.date}: ${j.data.summaries_upserted} outlet, ${j.data.alerts_created} alert baru, ${j.data.actions_created} action baru`);
      router.refresh();
    } catch { toast.error('Network error'); } finally { setBusy(false); }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Laporan Harian</h1>
          <p className='text-sm text-muted-foreground'>
            fin_daily_summary — satu baris per outlet per tanggal. Dibaca oleh Orchestration Layer & Hermez AI.
          </p>
        </div>
        {canGenerate && (
          <Btn onClick={regenerate} disabled={busy}>{busy ? 'Memproses…' : '⟳ Generate / Regenerate'}</Btn>
        )}
      </div>

      <div className='flex flex-wrap items-end gap-2 rounded border border-border bg-background p-2'>
        <div className='w-40'>
          <Input label='Tanggal' type='date' value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className='w-52'>
          <Select label='Outlet' value={outletId} onChange={setOutletId}>
            <option value=''>Semua Outlet</option>
            {props.outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
          </Select>
        </div>
        {availableDates.length > 0 && !availableDates.includes(date) && (
          <p className='text-[10px] text-amber-700 pb-2'>Tidak ada summary untuk {date} — menampilkan {effectiveDate}. Klik Generate untuk membuat.</p>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          message={`Belum ada summary untuk ${date}.\nKlik Generate untuk menghitung dari data POS/expense/supplier/kas kecil.`}
          ctaLabel={canGenerate ? 'Generate Sekarang' : undefined}
          onCta={canGenerate ? regenerate : undefined}
        />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-6'>
            <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>NET SALES</p><p className='text-sm font-bold'>{rp(group.net)}</p></div>
            <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>EXPENSE</p><p className='text-sm font-bold'>{rp(group.expense)}</p></div>
            <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>SUPPLIER COST</p><p className='text-sm font-bold'>{rp(group.supplier)}</p></div>
            <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>KAS KECIL</p><p className='text-sm font-bold'>{rp(group.petty)}</p></div>
            <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>ESTIMASI SURPLUS KAS</p><p className={`text-sm font-bold ${group.surplus < 0 ? 'text-red-700' : 'text-green-700'}`}>{rpSigned(group.surplus)}</p></div>
            <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>UNPAID SUPPLIER</p><p className='text-sm font-bold text-amber-700'>{rp(group.unpaid)}</p></div>
          </div>

          <Card title={`Summary per Outlet — ${effectiveDate}`} sub={`${rows.length} outlet · kolom sesuai kontrak Hermez (blueprint §9.2)`}>
            <div className='overflow-x-auto'>
              <table className='w-full text-xs'>
                <thead className='bg-muted text-muted-foreground'>
                  <tr>
                    <Th>Outlet</Th><Th right>Gross</Th><Th right>Net</Th><Th right>Trx</Th><Th right>AOV</Th>
                    <Th right>Supplier</Th><Th right>Kas Kecil</Th><Th right>Expense</Th><Th right>Unpaid</Th>
                    <Th right>Selisih Kas</Th><Th right>Estimasi Surplus</Th><Th>Issue</Th><Th>Rekomendasi</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.summary_id} className='border-t border-border'>
                      <Td bold>{r.outlet_name}</Td>
                      <Td right muted>{rp(r.gross_sales)}</Td>
                      <Td right>{rp(r.net_sales)}</Td>
                      <Td right muted>{r.transaction_count}</Td>
                      <Td right muted>{rp(r.aov)}</Td>
                      <Td right>{rp(r.supplier_cost)}</Td>
                      <Td right>{rp(r.petty_cash_out)}</Td>
                      <Td right>{rp(r.total_expense)}</Td>
                      <Td right muted>{rp(r.unpaid_supplier)}</Td>
                      <Td right>
                        <span className={Number(r.cash_difference) !== 0 ? 'font-medium text-red-700' : 'text-green-700'}>
                          {Number(r.cash_difference) !== 0 ? rpSigned(r.cash_difference) : '✓'}
                        </span>
                      </Td>
                      <Td right bold>
                        <span className={Number(r.estimated_surplus) < 0 ? 'text-red-700' : 'text-green-700'}>{rpSigned(r.estimated_surplus)}</span>
                      </Td>
                      <Td>
                        {r.major_finance_issue !== 'none'
                          ? <span className='font-medium text-amber-700'>{r.major_finance_issue}</span>
                          : <span className='text-muted-foreground'>none</span>}
                      </Td>
                      <Td muted>{r.recommended_action || '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={`Alert Hari Ini (${dayAlerts.length})`} sub='Dibuat otomatis oleh finance rules engine saat regenerate'>
            {dayAlerts.length === 0 ? (
              <p className='text-xs text-muted-foreground'>Tidak ada alert untuk tanggal ini.</p>
            ) : (
              <div className='space-y-1'>
                {dayAlerts.map((a) => (
                  <div key={a.alert_id} className='flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-xs'>
                    <div className='min-w-0'>
                      <p className='truncate font-medium'>{a.title}</p>
                      <p className='text-[10px] text-muted-foreground'>{a.outlet} · {a.alert_type}</p>
                    </div>
                    <div className='flex items-center gap-1'>
                      <Badge value={a.severity} />
                      <Badge value={a.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
