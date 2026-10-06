/**
 * Canonical master-data for the HR client (hr-master-data-realoutlets).
 * Pure, unit-testable — scripts/fix-master-data.ts is a thin runner over this.
 */

export interface RealOutlet {
  outlet_id: string;
  outlet_name: string;
  brand_id: string;
}

/** The four real client outlets (client instruction 2026-10-06). */
export const REAL_OUTLETS: RealOutlet[] = [
  { outlet_id: 'OL-012', outlet_name: 'Sekar Pizza Tirtodipuran', brand_id: 'BR-002' }, // Sekarpizza
  { outlet_id: 'OL-014', outlet_name: 'Sekar Pizza Colombo', brand_id: 'BR-002' }, // appended (was missing)
  { outlet_id: 'OL-011', outlet_name: 'Funkydak Colombo', brand_id: 'BR-001' }, // Funkydak
  { outlet_id: 'OL-013', outlet_name: 'Suburbun', brand_id: 'BR-003' } // renamed from "Suburbuns Colombo"
];

export const CANONICAL_STATUSES = ['PROBATION', 'PERMANENT', 'CONTRACT'] as const;
export type EmploymentStatus = (typeof CANONICAL_STATUSES)[number];

/** Labels exactly per client wording. Storage tokens stay upper-case. */
export const STATUS_LABELS: Record<EmploymentStatus, string> = {
  PROBATION: 'Probation',
  PERMANENT: 'Permanent',
  CONTRACT: 'Contract'
};

const STATUS_ALIASES: Record<string, EmploymentStatus> = {
  // probation
  PROBATION: 'PROBATION', PROBASI: 'PROBATION', PERCOBAAN: 'PROBATION', MASA_PROBASI: 'PROBATION',
  PROBATION_EMPLOYEE: 'PROBATION', PROB: 'PROBATION',
  // permanent
  PERMANENT: 'PERMANENT', PERMANEN: 'PERMANENT', TETAP: 'PERMANENT', KARYAWAN_TETAP: 'PERMANENT',
  KARYAWAN_TETAP__TETAP: 'PERMANENT', PEGAWAI_TETAP: 'PERMANENT', ORGANIK: 'PERMANENT', PERMANENT__TETAP: 'PERMANENT',
  // contract
  CONTRACT: 'CONTRACT', KONTRAK: 'CONTRACT', PKWT: 'CONTRACT', KONTRAK_KERJA: 'CONTRACT',
  CONTRACT_EMPLOYEE: 'CONTRACT', PEMBADANAN: 'CONTRACT', PPKWT: 'CONTRACT',
  PKWT__KONTRAK: 'CONTRACT', CONTRACT__KONTRAK: 'CONTRACT', PKWT_KONTRAK: 'CONTRACT'
};

/** Normalize a raw employment status to a canonical token, or null when unknown. */
export function normalizeEmploymentStatus(raw: string | undefined): EmploymentStatus | null {
  const key = (raw ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!key) return null;
  return STATUS_ALIASES[key] ?? null;
}

export function isActiveOutletStatus(status: string | undefined): boolean {
  return ['active', '1'].includes((status ?? '').trim().toLowerCase());
}

export function assertSheetsMigrationEnvironment(env: Record<string, string | undefined>): void {
  if (env.USE_MOCK_DB === 'true' || env.USE_POSTGRES === 'true') {
    throw new Error('Migration requires real Google Sheets, not mock or Postgres');
  }
  for (const key of ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'YKP_HR_SPREADSHEET_ID']) {
    if (!env[key]?.trim()) throw new Error(`Missing required configuration: ${key}`);
  }
}

export interface OutletMigrationRow {
  outlet_id: string;
  outlet_name: string;
  brand_id: string;
  status: string;
}

export interface OutletMigrationOperation {
  id: string;
  action: 'ADD_ACTIVE' | 'RENAME_ACTIVATE' | 'KEEP' | 'DEACTIVATE';
  name: string;
  brandId: string;
  detail: string;
}

export function planOutletMigration(
  outlets: OutletMigrationRow[],
  brands: { brand_id: string; brand_name: string }[]
): OutletMigrationOperation[] {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = [
    ['sekarpizzatirtodipuran'], ['sekarpizzacolombo'], ['funkydakcolombo'],
    ['suburbun', 'suburbuns', 'suburbunscolombo', 'suburbuncolombo']
  ];
  const brandAliases = [['sekarpizza'], ['sekarpizza'], ['funkydak'], ['suburbun', 'suburbuns']];
  const usedIds = new Set(outlets.map((o) => o.outlet_id));
  if (usedIds.size !== outlets.length || outlets.some((o) => !o.outlet_id)) throw new Error('Duplicate or empty outlet IDs');
  let nextId = Math.max(0, ...outlets.map((o) => /^OL-\d+$/.test(o.outlet_id) ? Number(o.outlet_id.slice(3)) : 0)) + 1;
  const retainedIds = new Set<string>();
  const plan: OutletMigrationOperation[] = [];
  REAL_OUTLETS.forEach((real, index) => {
    const matchingBrands = brands.filter((b) => brandAliases[index].includes(normalize(b.brand_name)));
    if (matchingBrands.length !== 1) throw new Error(`Missing or ambiguous brand for ${real.outlet_name}`);
    const brandId = matchingBrands[0].brand_id;
    const matches = outlets.filter((o) => aliases[index].includes(normalize(o.outlet_name)));
    if (matches.length > 1) throw new Error(`Ambiguous outlet: ${real.outlet_name}`);
    const existing = matches[0];
    if (existing && existing.brand_id !== brandId) throw new Error(`Brand mismatch for ${existing.outlet_id}; manual reconciliation required`);
    let id = existing?.outlet_id;
    if (!id) {
      while (usedIds.has(`OL-${String(nextId).padStart(3, '0')}`)) nextId++;
      id = `OL-${String(nextId++).padStart(3, '0')}`;
      usedIds.add(id);
    }
    retainedIds.add(id);
    const action = !existing ? 'ADD_ACTIVE' : existing.outlet_name === real.outlet_name && existing.status === 'active' ? 'KEEP' : 'RENAME_ACTIVATE';
    plan.push({ id, action, name: real.outlet_name, brandId, detail: `${existing?.outlet_name ?? '(new)'} → ${real.outlet_name}` });
  });
  for (const outlet of outlets) {
    if (!retainedIds.has(outlet.outlet_id) && isActiveOutletStatus(outlet.status)) {
      plan.push({ id: outlet.outlet_id, action: 'DEACTIVATE', name: outlet.outlet_name, brandId: outlet.brand_id, detail: outlet.outlet_name });
    }
  }
  return plan;
}

const DUMMY_NAME_HINTS = /smoke|test|dummy|contoh|example/i;

/** Rows matching dummy-name hints (e.g. "Smoke Test Outlet") should be deactivated too. */
export function isDummyOutletName(name: string): boolean {
  return DUMMY_NAME_HINTS.test(name ?? '');
}