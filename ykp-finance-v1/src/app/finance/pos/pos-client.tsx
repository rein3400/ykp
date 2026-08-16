'use client';
/**
 * Pendapatan POS — list + manual entry + import CSV Moka + settlement
 * validation view (Revisi #5: per-method breakdown, total, difference).
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { computeSettlement } from '@/lib/settlement';
import { todayWib, lastNDays } from '@/lib/wib';
import { Card, EmptyState, FilterBar, Btn, Modal, Input, Select, Th, Td, rp, rpSigned, type FilterState } from '../ui';

const PM_FIELDS = [
  ['settle_cash', 'Cash'], ['settle_qris', 'QRIS'], ['settle_card', 'Card'],
  ['settle_transfer', 'Transfer'], ['settle_marketplace', 'Marketplace']
] as const;

export default function PosClient(props: {
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
  pos: Record<string, string>[];
  thresholds: Record<string, string>[];
}) {
  const router = useRouter();
  const today = todayWib();
  const [f, setF] = useState<FilterState>({ brandId: '', outletId: '', from: lastNDays(14, today)[0], to: today });
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showImportItems, setShowImportItems] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => props.pos
    .filter((r) => r.date >= f.from && r.date <= f.to
      && (!f.brandId || r.brand_id === f.brandId)
      && (!f.outletId || r.outlet_id === f.outletId))
    .sort((a, b) => b.date.localeCompare(a.date) || a.outlet_id.localeCompare(b.outlet_id)),
  [props.pos, f]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    gross: acc.gross + Number(r.gross_sales || 0),
    net: acc.net + Number(r.net_sales || 0),
    tx: acc.tx + Number(r.transaction_count || 0),
    diff: acc.diff + Number(r.settlement_difference || 0)
  }), { gross: 0, net: 0, tx: 0, diff: 0 }), [rows]);

  const mismatches = rows.filter((r) => Number(r.settlement_difference) !== 0);

  return (
    <div className='space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Pendapatan POS</h1>
          <p className='text-sm text-muted-foreground'>Pendapatan harian outlet dari Moka/POS. Net Sales = Gross − Discount − Refund − Void.</p>
        </div>
        <div className='flex gap-2'>
          <Btn variant='outline' onClick={() => setShowSettlement(true)}>Validasi Settlement</Btn>
          <Btn variant='outline' onClick={() => setShowImport(true)}>Import CSV Moka</Btn>
          <Btn variant='outline' onClick={() => setShowImportItems(true)}>Import Item CSV</Btn>
          <Btn onClick={() => setShowForm(true)}>+ Tambah Transaksi</Btn>
        </div>
      </div>

      <FilterBar brands={props.brands} outlets={props.outlets} value={f} onChange={setF} />

      <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>GROSS SALES</p><p className='text-lg font-bold'>{rp(totals.gross)}</p></div>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>NET SALES</p><p className='text-lg font-bold'>{rp(totals.net)}</p></div>
        <div className='rounded border border-border p-3'><p className='text-[10px] text-muted-foreground'>TRANSAKSI / AOV</p><p className='text-lg font-bold'>{totals.tx} <span className='text-xs font-normal text-muted-foreground'>/ {rp(totals.tx > 0 ? Math.round(totals.net / totals.tx) : 0)}</span></p></div>
        <div className='rounded border border-border p-3'>
          <p className='text-[10px] text-muted-foreground'>SELISIH SETTLEMENT</p>
          <p className={`text-lg font-bold ${totals.diff !== 0 ? 'text-amber-700' : 'text-green-700'}`}>{totals.diff !== 0 ? rpSigned(totals.diff) : '✓ Cocok'}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          message={'Belum ada transaksi POS.\nImport CSV Moka atau tambah transaksi manual untuk memulai.'}
          ctaLabel='Import CSV Moka'
          onCta={() => setShowImport(true)}
          cta2Label='Tambah Transaksi'
          onCta2={() => setShowForm(true)}
        />
      ) : (
        <Card title='Transaksi Harian' sub={`${rows.length} baris`}>
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead className='bg-muted text-muted-foreground'>
                <tr>
                  <Th>Tanggal</Th><Th>Outlet</Th><Th right>Gross</Th><Th right>Disc</Th><Th right>Refund</Th>
                  <Th right>Void</Th><Th right>Net</Th><Th right>Trx</Th><Th right>AOV</Th>
                  <Th>Sumber</Th><Th>Settlement</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.pos_id} className='border-t border-border'>
                    <Td muted>{p.date}</Td>
                    <Td>{p.outlet_name}</Td>
                    <Td right>{rp(p.gross_sales)}</Td>
                    <Td right muted>{rp(p.discount)}</Td>
                    <Td right muted>{rp(p.refund)}</Td>
                    <Td right muted>{rp(p.void)}</Td>
                    <Td right bold>{rp(p.net_sales)}</Td>
                    <Td right muted>{p.transaction_count}</Td>
                    <Td right muted>{rp(p.aov)}</Td>
                    <Td muted>{p.source}</Td>
                    <Td>
                      {Number(p.settlement_difference) !== 0
                        ? <span className='font-medium text-amber-700' title='Total metode pembayaran ≠ net sales'>{rpSigned(p.settlement_difference)}</span>
                        : <span className='text-green-700'>✓</span>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showForm && (
        <PosForm
          outlets={props.outlets}
          onClose={() => setShowForm(false)}
          saving={saving}
          onSave={async (payload) => {
            setSaving(true);
            try {
              const r = await fetch('/api/finance/pos', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
              });
              const j = await r.json();
              if (!r.ok) { toast.error(j.error?.message ?? 'Gagal menyimpan'); return; }
              toast.success('Transaksi POS tersimpan');
              setShowForm(false);
              router.refresh();
            } catch { toast.error('Network error'); } finally { setSaving(false); }
          }}
        />
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); router.refresh(); }} />}
      {showImportItems && <ImportItemsModal onClose={() => setShowImportItems(false)} onDone={() => { setShowImportItems(false); router.refresh(); }} />}
      {showSettlement && <SettlementModal rows={mismatches.length > 0 ? mismatches : rows.slice(0, 20)} onlyMismatch={mismatches.length > 0} onClose={() => setShowSettlement(false)} />}
    </div>
  );
}

function PosForm({ outlets, onClose, onSave, saving }: {
  outlets: Record<string, string>[];
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [v, setV] = useState({
    date: todayWib(), outlet_id: outlets[0]?.outlet_id ?? '',
    gross_sales: '', discount: '0', refund: '0', void: '0',
    settle_cash: '', settle_qris: '0', settle_card: '0', settle_transfer: '0', settle_marketplace: '0',
    transaction_count: '', cashier: '', shift: 'Pagi', notes: ''
  });
  const num = (s: string) => Math.max(0, Math.trunc(Number(s) || 0));
  const net = num(v.gross_sales) - num(v.discount) - num(v.refund) - num(v.void);
  const settle = computeSettlement({
    cash: num(v.settle_cash), qris: num(v.settle_qris), card: num(v.settle_card),
    transfer: num(v.settle_transfer), marketplace: num(v.settle_marketplace)
  }, Math.max(0, net));
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <Modal title='Tambah Transaksi POS' onClose={onClose} wide>
      <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
        <Input label='Tanggal' type='date' value={v.date} onChange={set('date')} />
        <Select label='Outlet' value={v.outlet_id} onChange={(x) => setV({ ...v, outlet_id: x })}>
          {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
        </Select>
        <Input label='Jumlah Transaksi' type='number' value={v.transaction_count} onChange={set('transaction_count')} />
        <Input label='Gross Sales (Rp)' type='number' value={v.gross_sales} onChange={set('gross_sales')} />
        <Input label='Discount (Rp)' type='number' value={v.discount} onChange={set('discount')} />
        <Input label='Refund (Rp)' type='number' value={v.refund} onChange={set('refund')} />
        <Input label='Void (Rp)' type='number' value={v.void} onChange={set('void')} />
        <Input label='Kasir' value={v.cashier} onChange={set('cashier')} />
        <Select label='Shift' value={v.shift} onChange={(x) => setV({ ...v, shift: x })}>
          <option>Pagi</option><option>Siang</option><option>Malam</option>
        </Select>
      </div>
      <div className='mt-3 rounded border border-border p-2'>
        <p className='mb-2 text-[10px] font-semibold'>SETTLEMENT PER METODE (Revisi #5)</p>
        <div className='grid grid-cols-2 gap-2 md:grid-cols-5'>
          <Input label='Cash (Rp)' type='number' value={v.settle_cash} onChange={set('settle_cash')} />
          <Input label='QRIS (Rp)' type='number' value={v.settle_qris} onChange={set('settle_qris')} />
          <Input label='Card (Rp)' type='number' value={v.settle_card} onChange={set('settle_card')} />
          <Input label='Transfer (Rp)' type='number' value={v.settle_transfer} onChange={set('settle_transfer')} />
          <Input label='Marketplace (Rp)' type='number' value={v.settle_marketplace} onChange={set('settle_marketplace')} />
        </div>
      </div>
      <div className='mt-3 grid grid-cols-3 gap-2 rounded bg-muted p-2 text-xs'>
        <p>Net Sales: <b>{rp(Math.max(0, net))}</b></p>
        <p>Total Settlement: <b>{rp(settle.totalSettlement)}</b></p>
        <p>Selisih: <b className={settle.settlementDifference !== 0 ? 'text-amber-700' : 'text-green-700'}>{rpSigned(settle.settlementDifference)}</b></p>
      </div>
      <div className='mt-3 flex justify-end gap-2'>
        <Btn variant='outline' onClick={onClose}>Batal</Btn>
        <Btn
          disabled={saving || net <= 0 || !v.outlet_id}
          onClick={() => onSave({
            date: v.date, outlet_id: v.outlet_id,
            gross_sales: num(v.gross_sales), discount: num(v.discount), refund: num(v.refund), void: num(v.void),
            tax: 0, service_charge: 0,
            settle_cash: num(v.settle_cash), settle_qris: num(v.settle_qris), settle_card: num(v.settle_card),
            settle_transfer: num(v.settle_transfer), settle_marketplace: num(v.settle_marketplace),
            transaction_count: num(v.transaction_count), cashier: v.cashier, shift: v.shift, notes: v.notes
          })}
        >
          {saving ? 'Menyimpan…' : 'Simpan'}
        </Btn>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'csv' | 'sheet'>('csv');
  const [csv, setCsv] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ inserted: number; skipped: { date: string; outlet: string; reason: string }[]; errors: { row: number; reason: string }[]; variance_report: { total_input_lines: number; parsed_lines: number; dropped_lines: number; alias_guesses: Record<string, string> } } | null>(null);

  const canSubmit = busy ? false : mode === 'sheet' ? sheetUrl.trim().length > 0 : csv.trim().length > 0;

  async function doImport() {
    setBusy(true);
    try {
      const body = mode === 'sheet' ? { sheet_url: sheetUrl.trim() } : { csv };
      const r = await fetch('/api/finance/pos/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Import gagal'); return; }
      setReport(j.data);
      toast.success(`${j.data.inserted} baris berhasil diimport`);
    } catch { toast.error('Network error'); } finally { setBusy(false); }
  }

  return (
    <Modal title='Import Moka (CSV / Google Sheet)' onClose={onClose} wide>
      {!report ? (
        <>
          <div className='mb-2 flex gap-1 rounded border border-border p-1'>
            <button
              type='button'
              onClick={() => setMode('csv')}
              className={`flex-1 rounded px-2 py-1 text-xs ${mode === 'csv' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
            >Tempel CSV</button>
            <button
              type='button'
              onClick={() => setMode('sheet')}
              className={`flex-1 rounded px-2 py-1 text-xs ${mode === 'sheet' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
            >Dari Google Sheet</button>
          </div>

          {mode === 'csv' ? (
            <>
              <p className='mb-2 text-[10px] text-muted-foreground'>
                Format: header wajib memuat <code>date/tanggal, outlet, gross_sales, net_sales, payment_method</code>.
                Opsional: brand, discount, refund, void, tax, service_charge, transaction_count, shift.
                Tanggal dd/mm/yyyy atau yyyy-mm-dd. Baris dengan (tanggal, outlet) yang sama digabung otomatis.
              </p>
              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                rows={10}
                placeholder={'tanggal,outlet,gross_sales,net_sales,discount,refund,void,payment_method,transaction_count\n02/07/2026,Funkydak Cipete,5200000,5000000,100000,0,0,cash,95'}
                className='w-full rounded border border-border p-2 font-mono text-[10px]'
              />
            </>
          ) : (
            <>
              <p className='mb-2 text-[10px] text-muted-foreground'>
                Tempel URL Google Sheet (tab pertama atau <code>#gid=</code> tab tertentu). Sheet harus
                dibagikan ke service-account email sebagai <b>Viewer</b>. Header dan format sama dengan CSV.
              </p>
              <Input
                label='URL Google Sheet'
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder='https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0'
              />
            </>
          )}

          <div className='mt-3 flex justify-end gap-2'>
            <Btn variant='outline' onClick={onClose}>Batal</Btn>
            <Btn disabled={!canSubmit} onClick={doImport}>{busy ? 'Mengimport…' : 'Import'}</Btn>
          </div>
        </>
      ) : (
        <div className='space-y-2 text-xs'>
          <p className='font-semibold'>Hasil Import</p>
          <p>✅ {report.inserted} baris masuk · ⏭ {report.skipped.length} dilewati · ❌ {report.errors.length} error</p>
          {report.skipped.length > 0 && (
            <div className='rounded border border-amber-300 bg-amber-50 p-2'>
              <p className='font-medium'>Dilewati:</p>
              {report.skipped.map((s, i) => <p key={i} className='text-[10px]'>• {s.date} {s.outlet}: {s.reason}</p>)}
            </div>
          )}
          {report.errors.length > 0 && (
            <div className='rounded border border-red-300 bg-red-50 p-2'>
              <p className='font-medium'>Error:</p>
              {report.errors.map((e, i) => <p key={i} className='text-[10px]'>• Baris {e.row}: {e.reason}</p>)}
            </div>
          )}
          {Object.keys(report.variance_report.alias_guesses).length > 0 && (
            <div className='rounded border border-border p-2'>
              <p className='font-medium'>Payment method tidak dikenal:</p>
              {Object.keys(report.variance_report.alias_guesses).map((k) => <p key={k} className='text-[10px]'>• {k}</p>)}
            </div>
          )}
          <div className='flex justify-end'><Btn onClick={onDone}>Selesai</Btn></div>
        </div>
      )}
    </Modal>
  );
}

function ImportItemsModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'csv' | 'sheet'>('csv');
  const [csv, setCsv] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ inserted: number; skipped: { date: string; outlet: string; item: string; reason: string }[]; errors: { row: number; reason: string }[]; variance_report: { total_input_lines: number; parsed_lines: number; dropped_lines: number } } | null>(null);

  const canSubmit = busy ? false : mode === 'sheet' ? sheetUrl.trim().length > 0 : csv.trim().length > 0;

  async function doImport() {
    setBusy(true);
    try {
      const body = mode === 'sheet' ? { sheet_url: sheetUrl.trim() } : { csv };
      const r = await fetch('/api/finance/pos/items/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Import gagal'); return; }
      setReport(j.data);
      toast.success(`${j.data.inserted} baris item berhasil diimport`);
    } catch { toast.error('Network error'); } finally { setBusy(false); }
  }

  return (
    <Modal title='Import Item Moka (CSV / Google Sheet)' onClose={onClose} wide>
      {!report ? (
        <>
          <div className='mb-2 flex gap-1 rounded border border-border p-1'>
            <button
              type='button'
              onClick={() => setMode('csv')}
              className={`flex-1 rounded px-2 py-1 text-xs ${mode === 'csv' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
            >Tempel CSV</button>
            <button
              type='button'
              onClick={() => setMode('sheet')}
              className={`flex-1 rounded px-2 py-1 text-xs ${mode === 'sheet' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
            >Dari Google Sheet</button>
          </div>

          {mode === 'csv' ? (
            <>
              <p className='mb-2 text-[10px] text-muted-foreground'>
                Export dari Moka: <b>Reports → Item Sales → Export CSV</b>. Header wajib memuat{' '}
                <code>date/tanggal, outlet, item/nama_item, qty, net_sales</code>. Opsional: sku, category,
                gross_sales, discount, refund, brand. Baris (tanggal, outlet, item) yang sama digabung otomatis;
                duplikat dengan data yang sudah ada dilewati.
              </p>
              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                rows={10}
                placeholder={'tanggal,outlet,item_name,category,qty,gross_sales,net_sales\n02/07/2026,Funkydak Cipete,Ayam Geprek,Food,85,4250000,4200000'}
                className='w-full rounded border border-border p-2 font-mono text-[10px]'
              />
            </>
          ) : (
            <>
              <p className='mb-2 text-[10px] text-muted-foreground'>
                Tempel URL Google Sheet (tab pertama atau <code>#gid=</code> tab tertentu). Sheet harus
                dibagikan ke service-account email sebagai <b>Viewer</b>. Header dan format sama dengan CSV.
              </p>
              <Input
                label='URL Google Sheet'
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder='https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0'
              />
            </>
          )}

          <div className='mt-3 flex justify-end gap-2'>
            <Btn variant='outline' onClick={onClose}>Batal</Btn>
            <Btn disabled={!canSubmit} onClick={doImport}>{busy ? 'Mengimport…' : 'Import'}</Btn>
          </div>
        </>
      ) : (
        <div className='space-y-2 text-xs'>
          <p className='font-semibold'>Hasil Import Item</p>
          <p>✅ {report.inserted} baris masuk · ⏭ {report.skipped.length} dilewati · ❌ {report.errors.length} error</p>
          {report.skipped.length > 0 && (
            <div className='rounded border border-amber-300 bg-amber-50 p-2'>
              <p className='font-medium'>Dilewati:</p>
              {report.skipped.map((s, i) => <p key={i} className='text-[10px]'>• {s.date} {s.outlet} — {s.item}: {s.reason}</p>)}
            </div>
          )}
          {report.errors.length > 0 && (
            <div className='rounded border border-red-300 bg-red-50 p-2'>
              <p className='font-medium'>Error:</p>
              {report.errors.map((e, i) => <p key={i} className='text-[10px]'>• Baris {e.row}: {e.reason}</p>)}
            </div>
          )}
          <div className='flex justify-end'><Btn onClick={onDone}>Selesai</Btn></div>
        </div>
      )}
    </Modal>
  );
}

function SettlementModal({ rows, onlyMismatch, onClose }: {
  rows: Record<string, string>[]; onlyMismatch: boolean; onClose: () => void;
}) {
  return (
    <Modal title='Validasi Settlement POS' onClose={onClose} wide>
      <p className='mb-2 text-[10px] text-muted-foreground'>
        {onlyMismatch
          ? `${rows.length} baris dengan total metode pembayaran ≠ net sales. Sistem membuat alert SETTLEMENT_MISMATCH saat regenerate.`
          : 'Semua baris cocok. 20 baris terakhir ditampilkan.'}
      </p>
      <div className='overflow-x-auto'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <Th>Tanggal</Th><Th>Outlet</Th><Th right>Net Sales</Th>
              {PM_FIELDS.map(([, l]) => <Th key={l} right>{l}</Th>)}
              <Th right>Total</Th><Th right>Selisih</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.pos_id} className='border-t border-border'>
                <Td muted>{p.date}</Td>
                <Td>{p.outlet_name}</Td>
                <Td right bold>{rp(p.net_sales)}</Td>
                {PM_FIELDS.map(([k]) => <Td key={k} right muted>{rp(p[k])}</Td>)}
                <Td right>{rp(p.total_settlement)}</Td>
                <Td right bold>
                  <span className={Number(p.settlement_difference) !== 0 ? 'text-amber-700' : 'text-green-700'}>
                    {rpSigned(p.settlement_difference)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className='mt-3 flex justify-end'><Btn onClick={onClose}>Tutup</Btn></div>
    </Modal>
  );
}
