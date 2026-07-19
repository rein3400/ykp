'use client';
/**
 * Kas Kecil (Petty Cash) — Revisi #7: running balance PER AKUN
 * (brand/outlet/account/tanggal) dengan Opening, Top-up, Cash Out,
 * Physical Cash, Cash Difference, Closing Status. Urgent wajib approval.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { todayWib, lastNDays, monthOf } from '@/lib/wib';
import { canApprove, type Role } from '@/lib/rbac';
import { Card, EmptyState, FilterBar, Btn, Modal, Input, Select, Th, Td, Badge, rp, rpSigned, type FilterState } from '../ui';

export default function PettyClient(props: {
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
  accounts: Record<string, string>[];
  petty: Record<string, string>[];
  role: string;
}) {
  const router = useRouter();
  const today = todayWib();
  const [f, setF] = useState<FilterState>({ brandId: '', outletId: '', from: lastNDays(14, today)[0], to: today });
  const [accountId, setAccountId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const approver = canApprove(props.role as Role);

  const scopedAccounts = useMemo(() => props.accounts.filter((a) =>
    (!f.brandId || a.brand_id === f.brandId) && (!f.outletId || a.outlet_id === f.outletId)
  ), [props.accounts, f.brandId, f.outletId]);

  const rows = useMemo(() => props.petty
    .filter((r) => r.date >= f.from && r.date <= f.to
      && (!f.brandId || r.brand_id === f.brandId)
      && (!f.outletId || r.outlet_id === f.outletId)
      && (!accountId || r.account_id === accountId)
      && (!typeFilter
        || (typeFilter === 'debit' && Number(r.debit_topup) > 0)
        || (typeFilter === 'credit' && Number(r.credit_out) > 0)
        || (typeFilter === 'urgent' && r.urgent_flag === 'true')))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.created_at ?? '').localeCompare(a.created_at ?? '')),
  [props.petty, f, accountId, typeFilter]);

  // Per-account summary cards (Revisi #7)
  const accountSummaries = useMemo(() => scopedAccounts.map((a) => {
    const mine = props.petty
      .filter((r) => r.account_id === a.account_id)
      .sort((x, y) => x.date.localeCompare(y.date) || (x.created_at ?? '').localeCompare(y.created_at ?? ''));
    const month = monthOf(today);
    const before = mine.filter((r) => r.date < `${month}-01`);
    const opening = before.length > 0 ? Number(before.at(-1)?.running_balance || 0) : Number(a.opening_balance || 0);
    const monthRows = mine.filter((r) => r.date.startsWith(month));
    const topUp = monthRows.reduce((s, r) => s + Number(r.debit_topup || 0), 0);
    const cashOut = monthRows.reduce((s, r) => s + Number(r.credit_out || 0), 0);
    const last = mine.at(-1);
    const running = Number(last?.running_balance ?? opening + topUp - cashOut);
    const physical = last?.physical_cash ? Number(last.physical_cash) : null;
    const diff = last?.cash_difference ? Number(last.cash_difference) : physical !== null ? physical - running : null;
    return {
      account: a, opening, topUp, cashOut, running, physical, diff,
      closingStatus: last?.closing_status || '', cohStatus: last?.cash_on_hand_status || ''
    };
  }), [scopedAccounts, props.petty, today]);

  const monthTotals = useMemo(() => accountSummaries.reduce((acc, x) => ({
    opening: acc.opening + x.opening, topUp: acc.topUp + x.topUp,
    cashOut: acc.cashOut + x.cashOut, running: acc.running + x.running
  }), { opening: 0, topUp: 0, cashOut: 0, running: 0 }), [accountSummaries]);

  async function approve(id: string, action: 'approve' | 'reject') {
    try {
      const r = await fetch(`/api/finance/petty-cash/${id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action })
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal'); return; }
      toast.success(action === 'approve' ? 'Disetujui' : 'Ditolak');
      router.refresh();
    } catch { toast.error('Network error'); }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Kas Kecil</h1>
          <p className='text-sm text-muted-foreground'>Saldo berjalan per akun kas kecil. Running Balance = Saldo Awal + Debit − Kredit.</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>+ Catat Transaksi</Btn>
      </div>

      <FilterBar brands={props.brands} outlets={props.outlets} value={f} onChange={setF}
        extra={
          <>
            <div className='w-48'>
              <Select label='Akun Kas Kecil' value={accountId} onChange={setAccountId}>
                <option value=''>Semua Akun</option>
                {scopedAccounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name}</option>)}
              </Select>
            </div>
            <div className='w-32'>
              <Select label='Tipe' value={typeFilter} onChange={setTypeFilter}>
                <option value=''>Semua</option>
                <option value='debit'>Top Up</option>
                <option value='credit'>Pengeluaran</option>
                <option value='urgent'>Urgent</option>
              </Select>
            </div>
          </>
        }
      />

      <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>SALDO AWAL BULAN</p><p className='text-sm font-bold'>{rp(monthTotals.opening)}</p></div>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>TOTAL TOP UP</p><p className='text-sm font-bold text-green-700'>{rp(monthTotals.topUp)}</p></div>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>TOTAL PENGELUARAN</p><p className='text-sm font-bold text-amber-700'>{rp(monthTotals.cashOut)}</p></div>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>SALDO BERJALAN</p><p className='text-sm font-bold'>{rp(monthTotals.running)}</p></div>
      </div>

      <Card title='Posisi Per Akun' sub='Opening → Top-up → Cash Out → Running → Physical vs Difference'>
        <div className='overflow-x-auto'>
          <table className='w-full text-xs'>
            <thead className='bg-muted text-muted-foreground'>
              <tr>
                <Th>Akun</Th><Th>Outlet</Th><Th right>Opening</Th><Th right>Top Up</Th><Th right>Cash Out</Th>
                <Th right>Running</Th><Th right>Fisik</Th><Th right>Selisih</Th><Th>Closing</Th>
              </tr>
            </thead>
            <tbody>
              {accountSummaries.map(({ account: a, opening, topUp, cashOut, running, physical, diff, closingStatus, cohStatus }) => (
                <tr key={a.account_id} className='border-t border-border'>
                  <Td bold>{a.account_name}</Td>
                  <Td muted>{a.outlet_id}</Td>
                  <Td right muted>{rp(opening)}</Td>
                  <Td right>{rp(topUp)}</Td>
                  <Td right>{rp(cashOut)}</Td>
                  <Td right bold>{rp(running)}</Td>
                  <Td right muted>{physical !== null ? rp(physical) : '—'}</Td>
                  <Td right>
                    {diff !== null && diff !== 0
                      ? <span className='font-medium text-red-700'>{rpSigned(diff)}</span>
                      : <span className='text-green-700'>✓</span>}
                  </Td>
                  <Td>{closingStatus ? <Badge value={closingStatus} /> : <Badge value={cohStatus || 'OK'} />}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          message={'Belum ada transaksi kas kecil.\nCatat top up atau pengeluaran pertama.'}
          ctaLabel='Catat Transaksi'
          onCta={() => setShowForm(true)}
        />
      ) : (
        <Card title='Buku Kas Kecil' sub={`${rows.length} baris`}>
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead className='bg-muted text-muted-foreground'>
                <tr>
                  <Th>Tanggal</Th><Th>Akun</Th><Th>Deskripsi</Th>
                  <Th right>Top Up</Th><Th right>Keluar</Th><Th right>Saldo</Th>
                  <Th>Urgent</Th><Th>Approval</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.petty_id} className='border-t border-border'>
                    <Td muted>{r.date}</Td>
                    <Td muted>{r.account_id}</Td>
                    <Td>
                      {r.description}
                      {(r.linked_expense_id || r.linked_supplier_invoice_id) && (
                        <span className='ml-1 rounded bg-blue-100 px-1 text-[9px] text-blue-800' title='Terkait transaksi lain — tidak dihitung ganda'>
                          linked
                        </span>
                      )}
                    </Td>
                    <Td right>{Number(r.debit_topup) > 0 ? rp(r.debit_topup) : ''}</Td>
                    <Td right>{Number(r.credit_out) > 0 ? rp(r.credit_out) : ''}</Td>
                    <Td right bold>{rp(r.running_balance)}</Td>
                    <Td>{r.urgent_flag === 'true' ? <span className='text-red-700 font-medium'>⚠</span> : ''}</Td>
                    <Td><Badge value={r.approval_status} /></Td>
                    <Td>
                      {approver && r.approval_status === 'PENDING' && (
                        <div className='flex gap-1'>
                          <Btn variant='outline' onClick={() => approve(r.petty_id, 'approve')}>✓</Btn>
                          <Btn variant='ghost' onClick={() => approve(r.petty_id, 'reject')}>✗</Btn>
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showForm && (
        <PettyForm
          accounts={scopedAccounts}
          onClose={() => setShowForm(false)}
          onDone={() => { setShowForm(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function PettyForm({ accounts, onClose, onDone }: {
  accounts: Record<string, string>[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [v, setV] = useState({
    date: todayWib(), account_id: accounts[0]?.account_id ?? '',
    kind: 'credit', amount: '', description: '', category: 'Operational',
    receipt_url: '', urgent: false, notes: ''
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try {
      const amt = Math.trunc(Number(v.amount) || 0);
      const r = await fetch('/api/finance/petty-cash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: v.date, account_id: v.account_id, description: v.description,
          category: v.category, receipt_url: v.receipt_url, notes: v.notes,
          urgent_flag: v.urgent ? 'true' : 'false',
          debit_topup: v.kind === 'debit' ? String(amt) : '0',
          credit_out: v.kind === 'credit' ? String(amt) : '0'
        })
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal menyimpan'); return; }
      toast.success(v.urgent ? 'Tersimpan — menunggu approval (urgent)' : 'Transaksi kas kecil tersimpan');
      onDone();
    } catch { toast.error('Network error'); } finally { setBusy(false); }
  }

  return (
    <Modal title='Catat Transaksi Kas Kecil' onClose={onClose}>
      <div className='grid grid-cols-2 gap-2'>
        <Input label='Tanggal' type='date' value={v.date} onChange={set('date')} />
        <Select label='Akun' value={v.account_id} onChange={(x) => setV({ ...v, account_id: x })}>
          {accounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name}</option>)}
        </Select>
        <Select label='Jenis' value={v.kind} onChange={(x) => setV({ ...v, kind: x })}>
          <option value='credit'>Pengeluaran (Kredit)</option>
          <option value='debit'>Top Up (Debit)</option>
        </Select>
        <Input label='Jumlah (Rp)' type='number' value={v.amount} onChange={set('amount')} />
        <div className='col-span-2'><Input label='Deskripsi' value={v.description} onChange={set('description')} /></div>
        <Input label='Kategori' value={v.category} onChange={set('category')} />
        <Input label='URL Nota (opsional)' value={v.receipt_url} onChange={set('receipt_url')} />
        <label className='col-span-2 flex items-center gap-2 text-xs'>
          <input type='checkbox' checked={v.urgent} onChange={(e) => setV({ ...v, urgent: e.target.checked })} />
          Urgent — wajib approval finance_admin/owner
        </label>
      </div>
      <div className='mt-3 flex justify-end gap-2'>
        <Btn variant='outline' onClick={onClose}>Batal</Btn>
        <Btn disabled={busy || !v.amount || !v.description} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</Btn>
      </div>
    </Modal>
  );
}
