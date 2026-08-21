'use client';
/**
 * Pengaturan — master data (brand, outlet, supplier, kategori expense,
 * payment method, akun kas kecil) + Threshold Config editor (Revisi #10:
 * nama aturan, penjelasan, nilai, satuan, severity, scope brand/outlet,
 * aktif, terakhir diubah, diubah oleh — semua perubahan teraudit).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { can, type Role } from '@/lib/rbac';
import { Card, Btn, Modal, Input, Select, Th, Td, Badge, rp } from '../ui';

type TabKey = 'threshold' | 'brand' | 'outlet' | 'supplier' | 'category' | 'method' | 'account' | 'telegram';

const TABS_UI: { key: TabKey; label: string }[] = [
  { key: 'threshold', label: 'Threshold Config' },
  { key: 'brand', label: 'Brand' },
  { key: 'outlet', label: 'Outlet' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'category', label: 'Kategori Expense' },
  { key: 'method', label: 'Payment Method' },
  { key: 'account', label: 'Akun Kas Kecil' },
  { key: 'telegram', label: 'Telegram' }
];

export default function SettingsClient(props: {
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
  suppliers: Record<string, string>[];
  categories: Record<string, string>[];
  methods: Record<string, string>[];
  accounts: Record<string, string>[];
  thresholds: Record<string, string>[];
  appSettings: Record<string, string>[];
  role: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('threshold');
  const [editThreshold, setEditThreshold] = useState<Record<string, string> | null>(null);
  const [addEntity, setAddEntity] = useState<TabKey | null>(null);
  const canWriteMaster = can(props.role as Role, 'create', 'master');
  const canEditThreshold = can(props.role as Role, 'update', 'threshold');
  const canEditTelegram = can(props.role as Role, 'update', 'telegram');

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Pengaturan</h1>
        <p className='text-sm text-muted-foreground'>Master data & konfigurasi threshold untuk finance rules engine.</p>
      </div>

      <div className='flex flex-wrap gap-1'>
        {TABS_UI.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded px-3 py-1.5 text-xs font-medium ${tab === t.key ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'threshold' && (
        <Card
          title='Threshold Config'
          sub='Dipakai oleh finance rules engine saat regenerate. Semua perubahan tercatat di audit log.'
          action={canEditThreshold ? <Btn onClick={() => setEditThreshold({ key: '', label: '', value: '', unit: 'IDR', severity: 'MEDIUM', scope: 'GLOBAL', explanation: '', active: 'true' })}>+ Tambah Threshold</Btn> : undefined}
        >
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead className='bg-muted text-muted-foreground'>
                <tr>
                  <Th>Nama Aturan</Th><Th>Penjelasan</Th><Th right>Nilai</Th><Th>Satuan</Th>
                  <Th>Severity</Th><Th>Scope</Th><Th>Aktif</Th><Th>Terakhir Diubah</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {props.thresholds.map((t) => (
                  <tr key={t.threshold_id} className='border-t border-border'>
                    <Td>
                      <p className='font-medium'>{t.label || t.key}</p>
                      <p className='text-[9px] text-muted-foreground'>{t.key}</p>
                    </Td>
                    <Td muted>{t.explanation}</Td>
                    <Td right bold>{t.unit === 'IDR' ? rp(t.value) : t.value}</Td>
                    <Td muted>{t.unit}</Td>
                    <Td><Badge value={t.severity} /></Td>
                    <Td muted>
                      {t.scope}
                      {t.brand_id && ` · ${t.brand_id}`}
                      {t.outlet_id && ` · ${t.outlet_id}`}
                    </Td>
                    <Td><Badge value={t.active === 'true' ? 'ACTIVE' : 'CANCELLED'} /></Td>
                    <Td muted>{t.last_changed}<br />{t.changed_by}</Td>
                    <Td>
                      {canEditThreshold && <Btn variant='outline' onClick={() => setEditThreshold(t)}>Edit</Btn>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'brand' && (
        <MasterTable
          title='Master Brand'
          action={canWriteMaster ? <Btn onClick={() => setAddEntity('brand')}>+ Tambah Brand</Btn> : undefined}
          headers={['ID', 'Nama', 'Kode', 'Status']}
          rows={props.brands.map((b) => [b.brand_id, b.brand_name, b.brand_code, b.status])}
        />
      )}
      {tab === 'outlet' && (
        <MasterTable
          title='Master Outlet'
          action={canWriteMaster ? <Btn onClick={() => setAddEntity('outlet')}>+ Tambah Outlet</Btn> : undefined}
          headers={['ID', 'Brand', 'Nama', 'Kode', 'Alamat', 'Status']}
          rows={props.outlets.map((o) => [o.outlet_id, o.brand_id, o.outlet_name, o.outlet_code, o.address, o.status])}
        />
      )}
      {tab === 'supplier' && (
        <MasterTable
          title='Master Supplier'
          action={canWriteMaster ? <Btn onClick={() => setAddEntity('supplier')}>+ Tambah Supplier</Btn> : undefined}
          headers={['ID', 'Nama', 'Kategori', 'Telepon', 'Bank', 'No. Rekening', 'Status']}
          rows={props.suppliers.map((s) => [s.supplier_id, s.supplier_name, s.category, s.phone, s.bank_name, s.bank_account, s.status])}
        />
      )}
      {tab === 'category' && (
        <MasterTable
          title='Kategori Expense'
          action={canWriteMaster ? <Btn onClick={() => setAddEntity('category')}>+ Tambah Kategori</Btn> : undefined}
          headers={['ID', 'Nama', 'Tipe Akun', 'Status']}
          rows={props.categories.map((c) => [c.category_id, c.category_name, c.account_type, c.status])}
        />
      )}
      {tab === 'method' && (
        <MasterTable
          title='Payment Method'
          action={canWriteMaster ? <Btn onClick={() => setAddEntity('method')}>+ Tambah Metode</Btn> : undefined}
          headers={['ID', 'Nama', 'Tipe', 'Cash?', 'Status']}
          rows={props.methods.map((m) => [m.method_id, m.method_name, m.type, m.is_cash === 'true' ? 'YA' : 'tidak', m.status])}
        />
      )}
      {tab === 'account' && (
        <MasterTable
          title='Akun Kas Kecil'
          action={canWriteMaster ? <Btn onClick={() => setAddEntity('account')}>+ Tambah Akun</Btn> : undefined}
          headers={['ID', 'Nama', 'Outlet', 'Opening', 'Limit Harian', 'Status']}
          rows={props.accounts.map((a) => [a.account_id, a.account_name, a.outlet_id, rp(a.opening_balance), rp(a.daily_limit), a.status])}
        />
      )}
      {tab === 'telegram' && (
        <TelegramSettings
          appSettings={props.appSettings}
          canEdit={canEditTelegram}
          onDone={() => router.refresh()}
        />
      )}

      {editThreshold && (
        <ThresholdModal
          row={editThreshold}
          brands={props.brands}
          outlets={props.outlets}
          isNew={!editThreshold.threshold_id}
          onClose={() => setEditThreshold(null)}
          onDone={() => { setEditThreshold(null); router.refresh(); }}
        />
      )}
      {addEntity && (
        <AddMasterModal
          entity={addEntity}
          brands={props.brands}
          outlets={props.outlets}
          onClose={() => setAddEntity(null)}
          onDone={() => { setAddEntity(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function MasterTable({ title, headers, rows, action }: {
  title: string; headers: string[]; rows: string[][]; action?: React.ReactNode;
}) {
  return (
    <Card title={title} action={action}>
      <div className='overflow-x-auto'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>{headers.map((h) => <Th key={h}>{h}</Th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className='border-t border-border'>
                {r.map((c, j) => <Td key={j} muted={j > 0}>{j === 0 ? <b>{c}</b> : c}</Td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TelegramSettings({ appSettings, canEdit, onDone }: {
  appSettings: Record<string, string>[];
  canEdit: boolean;
  onDone: () => void;
}) {
  const ownerRow = appSettings.find((s) => s.setting_key === 'telegram_owner_chat_id');
  const [chatId, setChatId] = useState(ownerRow?.setting_value ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const r = await fetch('/api/finance/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'telegram_owner_chat_id',
          value: chatId,
          description: 'Chat id Telegram owner untuk daily brief & alert push'
        })
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal menyimpan'); return; }
      toast.success('Owner chat id tersimpan');
      onDone();
    } catch { toast.error('Network error'); } finally { setBusy(false); }
  }

  return (
    <Card
      title='Telegram'
      sub='Chat id owner untuk menerima daily brief & alert HIGH/CRITICAL. Bisa diubah tanpa edit .env.'
    >
      <div className='space-y-3'>
        <div className='rounded border border-border p-3'>
          <p className='text-[10px] text-muted-foreground mb-1'>Cara dapat chat id:</p>
          <ol className='list-decimal list-inside text-xs text-muted-foreground space-y-0.5'>
            <li>Chat bot <b>@justatestermaybot</b> di Telegram, kirim <code>/start</code>.</li>
            <li>Forward pesan apa pun ke <b>@userinfobot</b> — dia balas chat id kamu.</li>
            <li>Salin angka chat id (tanpa tanda kutip/spasi) ke kolom di bawah.</li>
          </ol>
        </div>
        <Input
          label='Owner Chat ID'
          placeholder='contoh: 5721500978'
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          disabled={!canEdit}
        />
        <div className='flex justify-end gap-2'>
          <Btn disabled={busy || !canEdit || !chatId.trim()} onClick={save}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </Btn>
        </div>
      </div>
    </Card>
  );
}

function ThresholdModal({ row, brands, outlets, isNew, onClose, onDone }: {
  row: Record<string, string>;
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
  isNew: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [v, setV] = useState({ ...row });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try {
      const r = isNew
        ? await fetch('/api/finance/thresholds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) })
        : await fetch(`/api/finance/thresholds/${row.threshold_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal menyimpan'); return; }
      toast.success('Threshold tersimpan (teraaudit)');
      onDone();
    } catch { toast.error('Network error'); } finally { setBusy(false); }
  }

  return (
    <Modal title={isNew ? 'Tambah Threshold' : `Edit — ${row.label || row.key}`} onClose={onClose}>
      <div className='grid grid-cols-2 gap-2'>
        <Input label='Key (teknis)' value={v.key ?? ''} onChange={set('key')} disabled={!isNew} />
        <Input label='Nama Aturan' value={v.label ?? ''} onChange={set('label')} />
        <div className='col-span-2'><Input label='Penjelasan' value={v.explanation ?? ''} onChange={set('explanation')} /></div>
        <Input label='Nilai' type='number' value={v.value ?? ''} onChange={set('value')} />
        <Select label='Satuan' value={v.unit ?? 'IDR'} onChange={(x) => setV({ ...v, unit: x })}>
          <option value='IDR'>IDR</option><option value='%'>%</option><option value='hari'>hari</option><option value='count'>count</option>
        </Select>
        <Select label='Severity' value={v.severity ?? 'MEDIUM'} onChange={(x) => setV({ ...v, severity: x })}>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select label='Scope' value={v.scope ?? 'GLOBAL'} onChange={(x) => setV({ ...v, scope: x })}>
          <option value='GLOBAL'>GLOBAL</option><option value='BRAND'>BRAND</option><option value='OUTLET'>OUTLET</option>
        </Select>
        {(v.scope === 'BRAND' || v.scope === 'OUTLET') && (
          <Select label='Brand' value={v.brand_id ?? ''} onChange={(x) => setV({ ...v, brand_id: x })}>
            <option value=''>—</option>
            {brands.map((b) => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
          </Select>
        )}
        {v.scope === 'OUTLET' && (
          <Select label='Outlet' value={v.outlet_id ?? ''} onChange={(x) => setV({ ...v, outlet_id: x })}>
            <option value=''>—</option>
            {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
          </Select>
        )}
        <Select label='Aktif' value={v.active ?? 'true'} onChange={(x) => setV({ ...v, active: x })}>
          <option value='true'>Aktif</option><option value='false'>Nonaktif</option>
        </Select>
      </div>
      <div className='mt-3 flex justify-end gap-2'>
        <Btn variant='outline' onClick={onClose}>Batal</Btn>
        <Btn disabled={busy || !v.value || !v.key} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</Btn>
      </div>
    </Modal>
  );
}

function AddMasterModal({ entity, brands, outlets, onClose, onDone }: {
  entity: TabKey;
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const entityMap: Record<string, string> = {
    brand: 'brand', outlet: 'outlet', supplier: 'supplier',
    category: 'expense_category', method: 'payment_method', account: 'petty_cash_account'
  };

  async function save() {
    setBusy(true);
    try {
      const r = await fetch('/api/finance/master-data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, entity: entityMap[entity] })
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal menyimpan'); return; }
      toast.success('Master data tersimpan');
      onDone();
    } catch { toast.error('Network error'); } finally { setBusy(false); }
  }

  return (
    <Modal title={`Tambah ${entity}`} onClose={onClose}>
      <div className='grid grid-cols-2 gap-2'>
        {entity === 'brand' && (
          <>
            <Input label='Nama Brand' value={v.brand_name ?? ''} onChange={set('brand_name')} />
            <Input label='Kode' value={v.brand_code ?? ''} onChange={set('brand_code')} />
          </>
        )}
        {entity === 'outlet' && (
          <>
            <Input label='Nama Outlet' value={v.outlet_name ?? ''} onChange={set('outlet_name')} />
            <Select label='Brand' value={v.brand_id ?? brands[0]?.brand_id ?? ''} onChange={(x) => setV({ ...v, brand_id: x })}>
              {brands.map((b) => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
            </Select>
            <Input label='Kode' value={v.outlet_code ?? ''} onChange={set('outlet_code')} />
            <Input label='Alamat' value={v.address ?? ''} onChange={set('address')} />
          </>
        )}
        {entity === 'supplier' && (
          <>
            <Input label='Nama Supplier' value={v.supplier_name ?? ''} onChange={set('supplier_name')} />
            <Input label='Kategori' value={v.category ?? ''} onChange={set('category')} />
            <Input label='Telepon' value={v.phone ?? ''} onChange={set('phone')} />
            <Input label='Bank' value={v.bank_name ?? ''} onChange={set('bank_name')} />
            <Input label='No. Rekening' value={v.bank_account ?? ''} onChange={set('bank_account')} />
            <Input label='Nama Rekening' value={v.account_holder ?? ''} onChange={set('account_holder')} />
          </>
        )}
        {entity === 'category' && (
          <>
            <Input label='Nama Kategori' value={v.category_name ?? ''} onChange={set('category_name')} />
            <Select label='Tipe Akun' value={v.account_type ?? 'OPEX'} onChange={(x) => setV({ ...v, account_type: x })}>
              <option value='OPEX'>OPEX</option><option value='COGS'>COGS</option>
              <option value='CAPEX'>CAPEX</option><option value='OTHER'>OTHER</option>
            </Select>
          </>
        )}
        {entity === 'method' && (
          <>
            <Input label='Nama Metode' value={v.method_name ?? ''} onChange={set('method_name')} />
            <Input label='Tipe' value={v.type ?? ''} onChange={set('type')} />
            <Select label='Termasuk Kas Fisik?' value={v.is_cash ?? 'false'} onChange={(x) => setV({ ...v, is_cash: x })}>
              <option value='false'>Tidak</option><option value='true'>Ya</option>
            </Select>
          </>
        )}
        {entity === 'account' && (
          <>
            <Input label='Nama Akun' value={v.account_name ?? ''} onChange={set('account_name')} />
            <Select label='Outlet' value={v.outlet_id ?? outlets[0]?.outlet_id ?? ''} onChange={(x) => setV({ ...v, outlet_id: x })}>
              {outlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
            </Select>
            <Input label='Opening Balance (Rp)' type='number' value={v.opening_balance ?? '1000000'} onChange={set('opening_balance')} />
            <Input label='Limit Harian (Rp)' type='number' value={v.daily_limit ?? '500000'} onChange={set('daily_limit')} />
          </>
        )}
      </div>
      <div className='mt-3 flex justify-end gap-2'>
        <Btn variant='outline' onClick={onClose}>Batal</Btn>
        <Btn disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</Btn>
      </div>
    </Modal>
  );
}
