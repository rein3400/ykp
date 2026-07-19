'use client';
/**
 * Closing Kas — fisik vs sistem (blueprint §7.4):
 * expected = opening + cash_revenue_in - cash_expense_out - petty_cash_out
 * difference = physical - expected (signed). Selisih ≥ Rp50.000 → alert HIGH.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { todayWib, lastNDays } from '@/lib/wib';
import { Card, EmptyState, FilterBar, Btn, Modal, Input, Select, Th, Td, rp, rpSigned, type FilterState } from '../ui';

export default function ClosingClient(props: {
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
  closing: Record<string, string>[];
}) {
  const router = useRouter();
  const today = todayWib();
  const [f, setF] = useState<FilterState>({ brandId: '', outletId: '', from: lastNDays(14, today)[0], to: today });
  const [showForm, setShowForm] = useState(false);

  const rows = useMemo(() => props.closing
    .filter((r) => r.date >= f.from && r.date <= f.to
      && (!f.brandId || r.brand_id === f.brandId)
      && (!f.outletId || r.outlet_id === f.outletId))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.created_at ?? '').localeCompare(a.created_at ?? '')),
  [props.closing, f]);

  const withDiff = rows.filter((r) => Number(r.cash_difference) !== 0);
  const totalAbsDiff = rows.reduce((s, r) => s + Math.abs(Number(r.cash_difference || 0)), 0);

  return (
    <div className='space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Closing Kas</h1>
          <p className='text-sm text-muted-foreground'>Hitung kas fisik vs sistem setiap malam. Selisih ≥ Rp50.000 memicu alert HIGH.</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>+ Catat Closing</Btn>
      </div>

      <FilterBar brands={props.brands} outlets={props.outlets} value={f} onChange={setF} />

      <div className='grid grid-cols-3 gap-2'>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>CLOSING TERCATAT</p><p className='text-lg font-bold'>{rows.length}</p></div>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>DENGAN SELISIH</p><p className={`text-lg font-bold ${withDiff.length > 0 ? 'text-amber-700' : 'text-green-700'}`}>{withDiff.length}</p></div>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>TOTAL |SELISIH|</p><p className='text-lg font-bold'>{rp(totalAbsDiff)}</p></div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          message={'Belum ada closing kas.\nCatat hitungan kas fisik pertama untuk mulai rekonsiliasi harian.'}
          ctaLabel='Catat Closing'
          onCta={() => setShowForm(true)}
        />
      ) : (
        <Card title='Riwayat Closing' sub={`${rows.length} baris`}>
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead className='bg-muted text-muted-foreground'>
                <tr>
                  <Th>Tanggal</Th><Th>Outlet</Th><Th right>Opening</Th><Th right>POS Cash</Th>
                  <Th right>Expense Cash</Th><Th right>Kas Kecil</Th><Th right>Expected</Th>
                  <Th right>Fisik</Th><Th right>Selisih</Th><Th>Catatan</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.closing_id} className='border-t border-border'>
                    <Td muted>{r.date}</Td>
                    <Td>{r.outlet_name}</Td>
                    <Td right muted>{rp(r.opening_cash)}</Td>
                    <Td right>{rp(r.pos_cash_sales)}</Td>
                    <Td right muted>{rp(r.cash_expense_out)}</Td>
                    <Td right muted>{rp(r.petty_cash_out)}</Td>
                    <Td right>{rp(r.expected_cash)}</Td>
                    <Td right bold>{rp(r.physical_cash)}</Td>
                    <Td right bold>
                      <span className={Number(r.cash_difference) !== 0 ? 'text-red-700' : 'text-green-700'}>
                        {Number(r.cash_difference) !== 0 ? rpSigned(r.cash_difference) : '✓'}
                      </span>
                    </Td>
                    <Td muted>{r.notes}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showForm && (
        <ClosingForm
          outlets={props.outlets}
          onClose={() => setShowForm(false)}
          onDone={() => { setShowForm(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function ClosingForm({ outlets, onClose, onDone }: {
  outlets: Record<string, string>[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [v, setV] = useState({ date: todayWib(), outlet_id: outlets[0]?.outlet_id ?? '', physical_cash: '', opening_cash: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try {
      const r = await fetch('/api/finance/closing-cash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v)
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal menyimpan'); return; }
      const diff = Number(j.data.cash_difference || 0);
      if (diff !== 0) toast.warning(`Closing tercatat — selisih kas ${rpSigned(diff)}`);
      else toast.success('Closing tercatat — kas cocok ✓');
      onDone();
    } catch { toast.error('Network error'); } finally { setBusy(false); }
  }

  return (
    <Modal title='Catat Closing Kas' onClose={onClose}>
      <div className='grid grid-cols-2 gap-2'>
        <Input label='Tanggal' type='date' value={v.date} onChange={set('date')} />
        <Select label='Outlet' value={v.outlet_id} onChange={(x) => setV({ ...v, outlet_id: x })}>
          {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
        </Select>
        <Input label='Kas Fisik Dihitung (Rp)' type='number' value={v.physical_cash} onChange={set('physical_cash')} />
        <Input label='Opening (kosongkan = fisik kemarin)' type='number' value={v.opening_cash} onChange={set('opening_cash')} />
        <div className='col-span-2'><Input label='Catatan' value={v.notes} onChange={set('notes')} /></div>
      </div>
      <p className='mt-2 text-[10px] text-muted-foreground'>
        Sistem menghitung expected cash dari POS cash + expense cash + kas kecil hari ini, lalu membandingkan dengan hitungan fisik.
      </p>
      <div className='mt-3 flex justify-end gap-2'>
        <Btn variant='outline' onClick={onClose}>Batal</Btn>
        <Btn disabled={busy || !v.physical_cash} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</Btn>
      </div>
    </Modal>
  );
}
