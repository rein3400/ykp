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

const DUMMY_NAME_HINTS = /smoke|test|dummy|contoh|example/i;

/** Rows matching dummy-name hints (e.g. "Smoke Test Outlet") should be deactivated too. */
export function isDummyOutletName(name: string): boolean {
  return DUMMY_NAME_HINTS.test(name ?? '');
}