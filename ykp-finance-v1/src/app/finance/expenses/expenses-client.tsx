'use client';
/**
 * Pengeluaran (Expense Log) — brief §6.5 + Revisi #8: tabel & filter lengkap
 * (periode, brand, outlet, kategori, payment method, approval status).
 * 15 kategori dari brief. Expense > Rp500.000 wajib approval (brief §10).
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { todayWib, lastNDays } from '@/lib/wib';
import { canApprove, can, type Role } from '@/lib/rbac';
import { Card, EmptyState, FilterBar, Btn, Modal, Input, Select, Th, Td, Badge, rp, type FilterState } from '../ui';

export default function ExpensesClient(props: {
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
  categories: Record<string, string>[];
  methods: Record<string, string>[];
  expenses: Record<string, string>[];
  role: string;
}) {
  const router = useRouter();
  const today = todayWib();
  const [f, setF] = useState<FilterState>({ brandId: '', outletId: '', from: lastNDays(30, today)[0], to: today });
  const [category, setCategory] = useState('');
  const [method, setMethod] = useState('');
  const [approval, setApproval] = useState('');
  const [showForm, setShowForm] = useState(false);
  const approver = canApprove(props.role as Role);
  const deleter = can(props.role as Role, 'delete', 'expense');

  const rows = useMemo(() => props.expenses
    .filter((r) => r.date >= f.from && r.date <= f.to
      && (!f.brandId || r.brand_id === f.brandId)
      && (!f.outletId || r.outlet_id === f.outletId)
      && (!category || r.expense_category === category)
      && (!method || r.payment_method === method)
      && (!approval || r.approval_status === approval))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.created_at ?? '').localeCompare(a.created_at ?? '')),
  [props.expenses, f, category, method, approval]);

  const activeRows = rows.filter((r) => r.approval_status !== 'CANCELLED' && r.approval_status !== 'REJECTED' && r.status !== 'CANCELLED');
  const total = activeRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of activeRows) m.set(r.expense_category, (m.get(r.expense_category) ?? 0) + Number(r.amount || 0));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [activeRows]);

  async function approve(id: string, action: 'approve' | 'reject') {
    try {
      const r = await fetch(`/api/finance/expenses/${id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action })
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal'); return; }
      toast.success(action === 'approve' ? 'Disetujui' : 'Ditolak');
      router.refresh();
    } catch { toast.error('Network error'); }
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus (batalkan) expense ini? Aksi tercatat di audit log.')) return;
    try {
      const r = await fetch(`/api/finance/expenses/${id}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal'); return; }
      toast.success('Expense dibatalkan');
      router.refresh();
    } catch { toast.error('Network error'); }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Pengeluaran</h1>
          <p className='text-sm text-muted-foreground'>Expense operasional non-supplier. Di atas Rp500.000 wajib approval.</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>+ Tambah Expense</Btn>
      </div>

      <FilterBar brands={props.brands} outlets={props.outlets} value={f} onChange={setF}
        extra={
          <>
            <div className='w-40'>
              <Select label='Kategori' value={category} onChange={setCategory}>
                <option value=''>Semua Kategori</option>
                {props.categories.map((c) => <option key={c.category_id} value={c.category_name}>{c.category_name}</option>)}
              </Select>
            </div>
            <div className='w-40'>
              <Select label='Payment Method' value={method} onChange={setMethod}>
                <option value=''>Semua Metode</option>
                {props.methods.map((m) => <option key={m.method_id} value={m.method_id}>{m.method_name}</option>)}
              </Select>
            </div>
            <div className='w-36'>
              <Select label='Approval' value={approval} onChange={setApproval}>
                <option value=''>Semua</option>
                {['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            </div>
          </>
        }
      />

      <div className='grid grid-cols-1 gap-3 lg:grid-cols-3'>
        <div className='rounded border border-border p-3'>
          <p className='text-[10px] text-muted-foreground'>TOTAL EXPENSE PERIODE</p>
          <p className='text-lg font-bold'>{rp(total)}</p>
        </div>
        <div className='rounded border border-border p-3 lg:col-span-2'>
          <p className='mb-1 text-[10px] text-muted-foreground'>KATEGORI TERBESAR</p>
          <div className='flex flex-wrap gap-2'>
            {byCategory.length === 0 && <span className='text-xs text-muted-foreground'>—</span>}
            {byCategory.map(([cat, amt]) => (
              <span key={cat} className='rounded bg-muted px-2 py-1 text-[10px]'>
                {cat}: <b>{rp(amt)}</b> ({total > 0 ? Math.round((amt / total) * 100) : 0}%)
              </span>
            ))}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          message={'Belum ada expense.\nCatat pengeluaran pertama untuk mulai tracking biaya operasional.'}
          ctaLabel='Tambah Expense'
          onCta={() => setShowForm(true)}
        />
      ) : (
        <Card title='Daftar Expense' sub={`${rows.length} baris`}>
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead className='bg-muted text-muted-foreground'>
                <tr>
                  <Th>Tanggal</Th><Th>Brand</Th><Th>Outlet</Th><Th>Kategori</Th><Th>Deskripsi</Th>
                  <Th right>Jumlah</Th><Th>Metode</Th><Th>Nota</Th><Th>Approval</Th><Th>Status</Th><Th>Dibuat</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.expense_id} className='border-t border-border'>
                    <Td muted>{r.date}</Td>
                    <Td muted>{r.brand_name}</Td>
                    <Td muted>{r.outlet_name}</Td>
                    <Td>{r.expense_category}</Td>
                    <Td>
                      {r.description}
                      {(r.linked_petty_cash_id || r.linked_supplier_invoice_id) && (
                        <span className='ml-1 rounded bg-blue-100 px-1 text-[9px] text-blue-800'>linked</span>
                      )}
                    </Td>
                    <Td right bold>{rp(r.amount)}</Td>
                    <Td muted>{props.methods.find((m) => m.method_id === r.payment_method)?.method_name ?? r.payment_method}</Td>
                    <Td>
                      {r.receipt_url
                        ? <a className='text-blue-700 underline' href={r.receipt_url} target='_blank' rel='noreferrer'>nota</a>
                        : <span className='text-amber-700'>—</span>}
                    </Td>
                    <Td><Badge value={r.approval_status} /></Td>
                    <Td><Badge value={r.status} /></Td>
                    <Td muted>{r.created_by}</Td>
                    <Td>
                      <div className='flex gap-1'>
                        {approver && r.approval_status === 'PENDING' && (
                          <>
                            <Btn variant='outline' onClick={() => approve(r.expense_id, 'approve')}>✓</Btn>
                            <Btn variant='ghost' onClick={() => approve(r.expense_id, 'reject')}>✗</Btn>
                          </>
                        )}
                        {deleter && r.approval_status !== 'CANCELLED' && (
                          <Btn variant='ghost' onClick={() => remove(r.expense_id)}>hapus</Btn>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showForm && (
        <ExpenseForm
          outlets={props.outlets}
          categories={props.categories}
          methods={props.methods}
          onClose={() => setShowForm(false)}
          onDone={() => { setShowForm(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function ExpenseForm({ outlets, categories, methods, onClose, onDone }: {
  outlets: Record<string, string>[];
  categories: Record<string, string>[];
  methods: Record<string, string>[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [v, setV] = useState({
    date: todayWib(), outlet_id: outlets[0]?.outlet_id ?? '',
    expense_category: categories[0]?.category_name ?? '',
    description: '', amount: '', payment_method: methods[0]?.method_id ?? 'PM-CASH',
    receipt_url: '', notes: ''
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const overLimit = Number(v.amount) > 500000;

  async function save() {
    setBusy(true);
    try {
      const r = await fetch('/api/finance/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, amount: String(Math.trunc(Number(v.amount) || 0)) })
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal menyimpan'); return; }
      toast.success(overLimit ? 'Tersimpan — menunggu approval (> Rp500.000)' : 'Expense tersimpan');
      onDone();
    } catch { toast.error('Network error'); } finally { setBusy(false); }
  }

  return (
    <Modal title='Tambah Expense' onClose={onClose}>
      <div className='grid grid-cols-2 gap-2'>
        <Input label='Tanggal' type='date' value={v.date} onChange={set('date')} />
        <Select label='Outlet' value={v.outlet_id} onChange={(x) => setV({ ...v, outlet_id: x })}>
          {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
        </Select>
        <Select label='Kategori' value={v.expense_category} onChange={(x) => setV({ ...v, expense_category: x })}>
          {categories.map((c) => <option key={c.category_id} value={c.category_name}>{c.category_name}</option>)}
        </Select>
        <Input label='Jumlah (Rp)' type='number' value={v.amount} onChange={set('amount')} />
        <div className='col-span-2'><Input label='Deskripsi' value={v.description} onChange={set('description')} /></div>
        <Select label='Payment Method' value={v.payment_method} onChange={(x) => setV({ ...v, payment_method: x })}>
          {methods.map((m) => <option key={m.method_id} value={m.method_id}>{m.method_name}</option>)}
        </Select>
        <Input label='URL Nota (opsional)' value={v.receipt_url} onChange={set('receipt_url')} />
      </div>
      {overLimit && (
        <p className='mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-800'>
          Jumlah di atas Rp500.000 — akan masuk sebagai PENDING dan wajib approval finance_admin/owner.
        </p>
      )}
      <div className='mt-3 flex justify-end gap-2'>
        <Btn variant='outline' onClick={onClose}>Batal</Btn>
        <Btn disabled={busy || !v.amount || !v.description} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</Btn>
      </div>
    </Modal>
  );
}
