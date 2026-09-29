/**
 * In-memory mock DB for local demo / Playwright when Sheets not configured.
 */
import { createHash } from 'crypto';
import { TAB_HEADERS, type TabName, TABS } from './sheets';

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const today = () => new Date().toISOString().slice(0, 10);

function seed(): Record<string, Record<string, string>[]> {
  const pw = createHash('sha256').update('owner123').digest('hex');
  return {
    [TABS.brands]: [
      { brand_id: 'BR-001', brand_name: 'Funkydak', brand_code: 'FD', status: 'active', created_at: now() },
    ],
    [TABS.outlets]: [
      {
        outlet_id: 'OL-001', brand_id: 'BR-001', outlet_name: 'Funkydak Kemang',
        outlet_code: 'FD-KM', address: 'Jl. Kemang', opening_time: '10:00',
        closing_time: '22:00', status: 'active', created_at: now(),
      },
    ],
    [TABS.employees]: [
      {
        employee_id: 'EMP-00001', full_name: 'Ayu Supervisor', role: 'supervisor',
        department: 'FOH', brand_id: 'BR-001', outlet_id: 'OL-001', status: 'active', created_at: now(),
      },
      {
        employee_id: 'EMP-00002', full_name: 'Budi Kitchen', role: 'staff',
        department: 'Kitchen', brand_id: 'BR-001', outlet_id: 'OL-001', status: 'active', created_at: now(),
      },
    ],
    [TABS.shifts]: [
      { shift_id: 'SH-001', shift_name: 'Morning', start_time: '10:00', end_time: '16:00', status: 'active' },
      { shift_id: 'SH-002', shift_name: 'Evening', start_time: '16:00', end_time: '22:00', status: 'active' },
    ],
    [TABS.products]: [
      {
        product_id: 'PR-001', brand_id: 'BR-001', product_name: 'Crispy Chicken',
        category: 'Main', qc_standard_id: '', target_serving_time: '180', status: 'active',
      },
    ],
    [TABS.checklistTemplates]: [
      // —— SOP Opening FnB (20 item sample — 5 kategori) ——
      // Kitchen
      { checklist_template_id: 'CT-OP-01', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Kitchen', checklist_item: 'Cek suhu chiller (1–4°C)', required_photo: 'true', target_value: '1–4°C', tolerance_value: '1°C', critical_flag: 'true', active_status: 'active' },
      { checklist_template_id: 'CT-OP-02', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Kitchen', checklist_item: 'Cek suhu freezer (-18°C)', required_photo: 'true', target_value: '-18°C', tolerance_value: '2°C', critical_flag: 'true', active_status: 'active' },
      { checklist_template_id: 'CT-OP-03', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Kitchen', checklist_item: 'Cek stok bahan baku & tanggal kadaluarsa (FIFO)', required_photo: 'false', target_value: 'FIFO', tolerance_value: '', critical_flag: 'true', active_status: 'active' },
      { checklist_template_id: 'CT-OP-04', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Kitchen', checklist_item: 'Bersihkan kompor, grill & fryer', required_photo: 'false', target_value: '', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      { checklist_template_id: 'CT-OP-05', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Kitchen', checklist_item: 'Mise en place kitchen (bumbu, saus, potongan)', required_photo: 'false', target_value: '', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      { checklist_template_id: 'CT-OP-06', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Kitchen', checklist_item: 'Cek stok minyak goreng & kejernihan', required_photo: 'false', target_value: 'jernih', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      { checklist_template_id: 'CT-OP-07', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Kitchen', checklist_item: 'Cek wastafel, sabun & lap bersih', required_photo: 'false', target_value: '', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      // Bar
      { checklist_template_id: 'CT-OP-08', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Bar', checklist_item: 'Cek mesin kopi (espresso, grinder, steam)', required_photo: 'false', target_value: '', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      { checklist_template_id: 'CT-OP-09', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Bar', checklist_item: 'Cek stok es, syrup & susu', required_photo: 'false', target_value: '', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      { checklist_template_id: 'CT-OP-10', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Bar', checklist_item: 'Mise en place bar (garnish, gelas, sedotan)', required_photo: 'false', target_value: '', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      { checklist_template_id: 'CT-OP-11', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Bar', checklist_item: 'Bersihkan area bar & display', required_photo: 'false', target_value: '', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      // FOH
      { checklist_template_id: 'CT-OP-12', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'FOH', checklist_item: 'Bersihkan lantai, meja, kursi & kaca', required_photo: 'false', target_value: '', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      { checklist_template_id: 'CT-OP-13', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'FOH', checklist_item: 'Setting meja & alat makan (cutlery, tisu, saus)', required_photo: 'false', target_value: '', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      { checklist_template_id: 'CT-OP-14', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'FOH', checklist_item: 'Cek toilet: bersih, tisu, sabun, pewangi', required_photo: 'true', target_value: '', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      { checklist_template_id: 'CT-OP-15', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'FOH', checklist_item: 'Cek AC, lampu & musik', required_photo: 'false', target_value: '', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      { checklist_template_id: 'CT-OP-16', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'FOH', checklist_item: 'Cek POS aktif & uang kecil (cash float)', required_photo: 'true', target_value: 'Rp 500.000', tolerance_value: '', critical_flag: 'true', active_status: 'active' },
      // Hygiene & Safety
      { checklist_template_id: 'CT-OP-17', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Hygiene', checklist_item: 'Staff cuci tangan & pakai APD (celemek, hairnet, sarung tangan)', required_photo: 'true', target_value: '', tolerance_value: '', critical_flag: 'true', active_status: 'active' },
      { checklist_template_id: 'CT-OP-18', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Hygiene', checklist_item: 'Tempat sampah kosong & ganti lining baru', required_photo: 'false', target_value: '', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      { checklist_template_id: 'CT-OP-19', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Hygiene', checklist_item: 'Cek APAR & jalur evakuasi bebas halangan', required_photo: 'true', target_value: '', tolerance_value: '', critical_flag: 'true', active_status: 'active' },
      { checklist_template_id: 'CT-OP-20', brand_id: 'BR-001', outlet_id: 'OL-001', checklist_type: 'OPENING', department: 'Hygiene', checklist_item: 'Briefing pagi & pembagian tugas shift', required_photo: 'false', target_value: '', tolerance_value: '', critical_flag: 'false', active_status: 'active' },
      {
        checklist_template_id: 'CT-003', brand_id: 'BR-001', outlet_id: 'OL-001',
        checklist_type: 'CLOSING', department: 'FOH', checklist_item: 'Kasir tutup & hitung kas',
        required_photo: 'true', target_value: '', tolerance_value: '',
        critical_flag: 'true', active_status: 'active',
      },
      {
        checklist_template_id: 'CT-004', brand_id: 'BR-001', outlet_id: 'OL-001',
        checklist_type: 'CLOSING', department: 'Kitchen', checklist_item: 'Matikan gas & kompor',
        required_photo: 'false', target_value: '', tolerance_value: '',
        critical_flag: 'true', active_status: 'active',
      },
      {
        checklist_template_id: 'CT-005', brand_id: 'BR-001', outlet_id: 'OL-001',
        checklist_type: 'GENERAL', department: 'FOH', checklist_item: 'Area dapur & serving bersih',
        required_photo: 'false', target_value: '', tolerance_value: '',
        critical_flag: 'false', active_status: 'active',
      },
    ],
    [TABS.checklistSubmissions]: [],
    [TABS.briefing]: [],
    [TABS.opening]: [],
    [TABS.kds]: [],
    [TABS.qc]: [],
    [TABS.incidents]: [],
    [TABS.closing]: [],
    [TABS.waste]: [],
    [TABS.stockIssues]: [],
    [TABS.thresholds]: [
      {
        threshold_id: 'TH-001', brand_id: 'BR-001', outlet_id: 'OL-001',
        metric_name: 'serving_time', warning_value: '180', high_value: '240',
        critical_value: '360', unit: 'seconds', active_status: 'active',
        updated_by: 'USR-001', updated_at: now(),
      },
      {
        threshold_id: 'TH-002', brand_id: 'BR-001', outlet_id: 'OL-001',
        metric_name: 'cash_difference', warning_value: '50000', high_value: '100000',
        critical_value: '200000', unit: 'IDR', active_status: 'active',
        updated_by: 'USR-001', updated_at: now(),
      },
    ],
    [TABS.summary]: [],
    [TABS.users]: [
      {
        user_id: 'USR-001', username: 'owner', password_hash: pw, role: 'owner',
        brand_id: '', outlet_id: '', active_status: 'active', created_at: now(), last_login_at: '',
      },
    ],
    [TABS.auditLog]: [],
    [TABS.hermezAlerts]: [],
  };
}

// Store is kept on globalThis via Symbol.for so it is shared across every
// module graph in the dev server / route handlers / server components.
// A module-local `let` gives each bundled route its own copy, so a POST
// writes to one instance while the page re-render (after router.refresh())
// reads a fresh, empty one — data "saves" (201) but never appears.
// Symbol.for is used instead of a string key because the Symbol registry
// is truly process-global and immune to string-key collisions or accidental
// deletion, making the singleton robust across Turbopack HMR re-evaluations.
const STORE_SYMBOL = Symbol.for('ykpOpsMockStore');

type StoreShape = Record<string, Record<string, string>[]>;

function getStore(): StoreShape {
  const g = globalThis as unknown as Record<symbol, StoreShape | undefined>;
  if (!g[STORE_SYMBOL]) {
    g[STORE_SYMBOL] = seed();
  }
  return g[STORE_SYMBOL] as StoreShape;
}

export function isMockMode(): boolean {
  if (process.env.USE_MOCK_DB === 'true') return true;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) return true;
  if (!process.env.YKP_OPS_SPREADSHEET_ID) return true;
  return false;
}

export function mockReadTab(tab: TabName): Record<string, string>[] {
  return [...(getStore()[tab] ?? [])];
}

export function mockAppendRows(
  tab: TabName,
  rows: Record<string, string>[]
): { startRow: number } {
  const s = getStore();
  if (!s[tab]) s[tab] = [];
  const startRow = s[tab].length + 2;
  s[tab].push(...rows.map((r) => {
    const headers = TAB_HEADERS[tab];
    const full: Record<string, string> = {};
    headers.forEach((h) => { full[h] = r[h] ?? ''; });
    return full;
  }));
  return { startRow };
}

export function mockUpdateRow(
  tab: TabName,
  rowIndex: number,
  row: Record<string, string>
): void {
  const s = getStore();
  const idx = rowIndex - 2;
  if (!s[tab] || idx < 0 || idx >= s[tab].length) {
    throw new Error(`mockUpdateRow: ${tab} row ${rowIndex} out of range (len ${s[tab]?.length ?? 0})`);
  }
  s[tab][idx] = { ...s[tab][idx], ...row };
}

export function mockFindRow(
  tab: TabName,
  keyCol: string,
  keyVal: string
): { row: Record<string, string>; rowIndex: number } | null {
  const rows = mockReadTab(tab);
  const idx = rows.findIndex((r) => r[keyCol] === keyVal);
  if (idx < 0) return null;
  return { row: rows[idx], rowIndex: idx + 2 };
}

export function mockReset(): void {
  const g = globalThis as unknown as Record<symbol, StoreShape | undefined>;
  g[STORE_SYMBOL] = seed();
}

export { today as mockToday };
