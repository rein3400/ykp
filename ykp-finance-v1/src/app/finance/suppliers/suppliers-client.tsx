'use client';
/**
 * Pembelian Supplier (Costing) — Revisi #6: invoice no/photo, payment proof,
 * due date, paid/remaining, partial payment, approval, approve-payment flow.
 * Aging view per Revisi #9.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { todayWib, lastNDays } from '@/lib/wib';
import { unpaidAging } from '@/lib/fin-summary';
import { canApprove, type Role } from '@/lib/rbac';
import { Card, EmptyState, FilterBar, Btn, Modal, Input, Select, Th, Td, Badge, rp, type FilterState } from '../ui';

export default function SuppliersClient(props: {
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
  suppliers: Record<string, string>[];
  costs: Record<string, string>[];
  pettyAccounts: Record<string, string>[];
  role: string;
}) {
  const router = useRouter();
  const today = todayWib();
  const [f, setF] = useState<FilterState>({ brandId: '', outletId: '', from: lastNDays(30, today)[0], to: today });
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [payTarget, setPayTarget] = useState<Record<string, string> | null>(null);
  const approver = canApprove(props.role as Role);

  const rows = useMemo(() => props.costs
    .filter((r) => r.date_order >= f.from && r.date_order <= f.to
      && (!f.brandId || r.brand_id === f.brandId)
      && (!f.outletId || r.outlet_id === f.outletId)
      && (!status || r.payment_status === status)
      && (!q || `${r.supplier_name} ${r.description} ${r.invoice_number} ${r.bank_account}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.date_order.localeCompare(a.date_order)),
  [props.costs, f, status, q]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    total: acc.total + (r.payment_status !== 'CANCELLED' ? Number(r.total_amount || 0) : 0),
    paid: acc.paid + Number(r.paid_amount || 0),
    unpaid: acc.unpaid + Number(r.unpaid_amount || 0)
  }), { total: 0, paid: 0, unpaid: 0 }), [rows]);

  const aging = useMemo(() => unpaidAging(props.costs, today, {
    brandId: f.brandId || undefined, outletId: f.outletId || undefined
  }), [props.costs, today, f.brandId, f.outletId]);

  return (
    <div className='space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Pembelian Supplier</h1>
          <p className='text-sm text-muted-foreground'>Costing supplier: invoice, approval, pembayaran parsial, jatuh tempo.</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>+ Tambah Invoice</Btn>
      </div>

      <FilterBar brands={props.brands} outlets={props.outlets} value={f} onChange={setF}
        extra={
          <>
            <div className='w-36'>
              <Select label='Status Bayar' value={status} onChange={setStatus}>
                <option value=''>Semua Status</option>
                {['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className='w-52'>
              <Input label='Cari' placeholder='supplier / barang / no invoice / rek' value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </>
        }
      />

      <div className='grid grid-cols-3 gap-2 md:grid-cols-6'>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>TOTAL</p><p className='text-sm font-bold'>{rp(totals.total)}</p></div>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>DIBAYAR</p><p className='text-sm font-bold text-green-700'>{rp(totals.paid)}</p></div>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>BELUM DIBAYAR</p><p className='text-sm font-bold text-amber-700'>{rp(totals.unpaid)}</p></div>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>OVERDUE 1-7 HARI</p><p className='text-sm font-bold'>{rp(aging.d1_7)}</p></div>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>8-14 HARI</p><p className='text-sm font-bold text-amber-700'>{rp(aging.d8_14)}</p></div>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>&gt;14 HARI</p><p className='text-sm font-bold text-red-700'>{rp(aging.d15_30 + aging.over30)}</p></div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          message={'Belum ada pembelian supplier.\nTambah invoice pertama untuk mulai tracking costing.'}
          ctaLabel='Tambah Invoice'
          onCta={() => setShowForm(true)}
        />
      ) : (
        <Card title='Daftar Invoice' sub={`${rows.length} baris`}>
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead className='bg-muted text-muted-foreground'>
                <tr>
                  <Th>Tanggal</Th><Th>Supplier</Th><Th>Deskripsi</Th><Th>Invoice</Th>
                  <Th right>Total</Th><Th right>Dibayar</Th><Th right>Sisa</Th>
                  <Th>Jatuh Tempo</Th><Th>Status</Th><Th>Approval</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.costing_id} className='border-t border-border'>
                    <Td muted>{r.date_order}</Td>
                    <Td bold>{r.supplier_name}</Td>
                    <Td muted>{r.description}</Td>
                    <Td muted>
                      {r.invoice_url
                        ? <a className='text-blue-700 underline' href={r.invoice_url} target='_blank' rel='noreferrer'>{r.invoice_number || 'nota'}</a>
                        : (r.invoice_number || <span className='text-amber-700'>tanpa nota</span>)}
                    </Td>
                    <Td right>{rp(r.total_amount)}</Td>
                    <Td right muted>{rp(r.paid_amount)}</Td>
                    <Td right bold>{rp(r.unpaid_amount)}</Td>
                    <Td muted>{r.due_date || '—'}</Td>
                    <Td><Badge value={r.payment_status} /></Td>
                    <Td><Badge value={r.approval_status} /></Td>
                    <Td>
                      {approver && Number(r.unpaid_amount) > 0 && !['PAID', 'CANCELLED', 'REJECTED'].includes(r.approval_status) && (
                        <Btn variant='outline' onClick={() => setPayTarget(r)}>Bayar</Btn>
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
        <SupplierForm
          outlets={props.outlets}
          suppliers={props.suppliers}
          onClose={() => setShowForm(false)}
          onDone={() => { setShowForm(false); router.refresh(); }}
        />
      )}
      {payTarget && (
        <PayModal
          row={payTarget}
          pettyAccounts={props.pettyAccounts.filter((a) => a.outlet_id === payTarget.outlet_id)}
          onClose={() => setPayTarget(null)}
          onDone={() => { setPayTarget(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function SupplierForm({ outlets, suppliers, onClose, onDone }: {
  outlets: Record<string, string>[];
  suppliers: Record<string, string>[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [v, setV] = useState({
    date_order: todayWib(), outlet_id: outlets[0]?.outlet_id ?? '', supplier_id: suppliers[0]?.supplier_id ?? '',
    description: '', category: '', total_amount: '', paid_amount: '0', due_date: '',
    invoice_number: '', invoice_url: '', notes: ''
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try {
      const r = await fetch('/api/finance/suppliers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...v,
          total_amount: String(Math.trunc(Number(v.total_amount) || 0)),
          paid_amount: String(Math.trunc(Number(v.paid_amount) || 0))
        })
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal menyimpan'); return; }
      toast.success('Invoice supplier tersimpan (PENDING approval)');
      onDone();
    } catch { toast.error('Network error'); } finally { setBusy(false); }
  }

  return (
    <Modal title='Tambah Invoice Supplier' onClose={onClose} wide>
      <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
        <Input label='Tanggal Order' type='date' value={v.date_order} onChange={set('date_order')} />
        <Select label='Outlet' value={v.outlet_id} onChange={(x) => setV({ ...v, outlet_id: x })}>
          {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
        </Select>
        <Select label='Supplier' value={v.supplier_id} onChange={(x) => setV({ ...v, supplier_id: x })}>
          {suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
        </Select>
        <Input label='Deskripsi Barang/Jasa' value={v.description} onChange={set('description')} />
        <Input label='Kategori' placeholder='Bahan Baku / Packaging / …' value={v.category} onChange={set('category')} />
        <Input label='Total (Rp)' type='number' value={v.total_amount} onChange={set('total_amount')} />
        <Input label='Sudah Dibayar (Rp, opsional)' type='number' value={v.paid_amount} onChange={set('paid_amount')} />
        <Input label='Jatuh Tempo' type='date' value={v.due_date} onChange={set('due_date')} />
        <Input label='No. Invoice' value={v.invoice_number} onChange={set('invoice_number')} />
        <Input label='URL Foto Invoice/Nota' placeholder='https://…' value={v.invoice_url} onChange={set('invoice_url')} />
        <Input label='Catatan' value={v.notes} onChange={set('notes')} />
      </div>
      <div className='mt-3 flex justify-end gap-2'>
        <Btn variant='outline' onClick={onClose}>Batal</Btn>
        <Btn disabled={busy || !v.total_amount || !v.description} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</Btn>
      </div>
    </Modal>
  );
}

function PayModal({ row, pettyAccounts, onClose, onDone }: {
  row: Record<string, string>;
  pettyAccounts: Record<string, string>[];
  onClose: () => void;
  onDone: () => void;
}) {
  const remaining = Number(row.unpaid_amount || 0);
  const [action, setAction] = useState<'pay' | 'approve' | 'reject'>('pay');
  const [amount, setAmount] = useState(String(remaining));
  const [source, setSource] = useState('transfer');
  const [accountId, setAccountId] = useState(pettyAccounts[0]?.account_id ?? '');
  const [ref, setRef] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const r = await fetch(`/api/finance/suppliers/${row.costing_id}/approve-payment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          paid_amount: action === 'pay' ? String(Math.trunc(Number(amount) || 0)) : undefined,
          payment_source: source,
          petty_account_id: source === 'petty_cash' ? accountId : undefined,
          payment_ref: ref,
          reason
        })
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal'); return; }
      toast.success(action === 'pay' ? 'Pembayaran tercatat' : action === 'approve' ? 'Invoice di-approve' : 'Invoice di-reject');
      onDone();
    } catch { toast.error('Network error'); } finally { setBusy(false); }
  }

  return (
    <Modal title={`Approve / Bayar — ${row.supplier_name}`} onClose={onClose}>
      <div className='space-y-2 text-xs'>
        <p>Total: <b>{rp(row.total_amount)}</b> · Sisa: <b className='text-amber-700'>{rp(remaining)}</b></p>
        <Select label='Aksi' value={action} onChange={(x) => setAction(x as 'pay')}>
          <option value='pay'>Catat Pembayaran</option>
          {row.approval_status === 'PENDING' && <option value='approve'>Approve Saja</option>}
          {row.approval_status === 'PENDING' && <option value='reject'>Reject</option>}
        </Select>
        {action === 'pay' && (
          <>
            <Input label={`Jumlah Bayar (Rp, maks ${remaining})`} type='number' value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Select label='Sumber Dana' value={source} onChange={setSource}>
              <option value='transfer'>Transfer Bank</option>
              <option value='cash'>Cash</option>
              <option value='petty_cash'>Kas Kecil (otomatis catat pengeluaran kas kecil, anti double-count)</option>
            </Select>
            {source === 'petty_cash' && (
              <Select label='Akun Kas Kecil' value={accountId} onChange={setAccountId}>
                {pettyAccounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name}</option>)}
              </Select>
            )}
            <Input label='Referensi Pembayaran (no. transfer / bukti)' value={ref} onChange={(e) => setRef(e.target.value)} />
          </>
        )}
        <Input label='Alasan / Catatan' value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className='mt-3 flex justify-end gap-2'>
        <Btn variant='outline' onClick={onClose}>Batal</Btn>
        <Btn disabled={busy || (action === 'pay' && (Number(amount) <= 0 || Number(amount) > remaining))} onClick={submit}>
          {busy ? 'Memproses…' : 'Konfirmasi'}
        </Btn>
      </div>
    </Modal>
  );
}
