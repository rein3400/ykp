import { describe, it, expect } from 'vitest';
import {
  REAL_OUTLETS, CANONICAL_STATUSES, STATUS_LABELS,
  normalizeEmploymentStatus, isDummyOutletName, planOutletMigration, assertSheetsMigrationEnvironment, isActiveOutletStatus
} from './master-data';

describe('REAL_OUTLETS (client 2026-10-06)', () => {
  it('contains exactly the four real outlets with unique stable ids', () => {
    expect(REAL_OUTLETS.map((o) => o.outlet_name)).toEqual([
      'Sekar Pizza Tirtodipuran', 'Sekar Pizza Colombo', 'Funkydak Colombo', 'Suburbun'
    ]);
    expect(new Set(REAL_OUTLETS.map((o) => o.outlet_id)).size).toBe(4);
    expect(REAL_OUTLETS.every((o) => /^OL-\d{3}$/.test(o.outlet_id))).toBe(true);
  });
});

const brands = [
  { brand_id: 'BR-P', brand_name: 'Sekarpizza' },
  { brand_id: 'BR-F', brand_name: 'Funkydak' },
  { brand_id: 'BR-S', brand_name: 'Suburbuns' }
];

describe('safe outlet migration', () => {
  it('preserves matched IDs and never renames an unrelated preferred ID', () => {
    const plan = planOutletMigration([
      { outlet_id: 'OL-012', outlet_name: 'Unrelated', brand_id: 'BR-F', status: 'active' },
      { outlet_id: 'OL-099', outlet_name: 'Sekarpizza Tirtodipuran', brand_id: 'BR-P', status: 'active' }
    ], brands);
    expect(plan.find((p) => p.name === 'Sekar Pizza Tirtodipuran')?.id).toBe('OL-099');
    expect(plan.find((p) => p.id === 'OL-012')?.action).toBe('DEACTIVATE');
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });
  it('is idempotent using the actual status schema and live brand IDs', () => {
    const first = planOutletMigration([], brands);
    const rows = first.map((p) => ({ outlet_id: p.id, outlet_name: p.name, brand_id: p.brandId, status: 'active' }));
    expect(planOutletMigration(rows, brands).every((p) => p.action === 'KEEP')).toBe(true);
    expect(isActiveOutletStatus('active')).toBe(true);
    expect(isActiveOutletStatus('inactive')).toBe(false);
  });
  it('rejects ambiguous outlets and missing brands', () => {
    expect(() => planOutletMigration([], [])).toThrow();
    expect(() => planOutletMigration([
      { outlet_id: 'A', outlet_name: 'Suburbun', brand_id: 'BR-S', status: 'active' },
      { outlet_id: 'B', outlet_name: 'Suburbuns Colombo', brand_id: 'BR-S', status: 'active' }
    ], brands)).toThrow();
  });
  it('refuses mock, Postgres, and incomplete Sheets credentials', () => {
    expect(() => assertSheetsMigrationEnvironment({})).toThrow();
    expect(() => assertSheetsMigrationEnvironment({ USE_POSTGRES: 'true' })).toThrow();
    expect(() => assertSheetsMigrationEnvironment({ USE_MOCK_DB: 'true' })).toThrow();
    expect(() => assertSheetsMigrationEnvironment({ GOOGLE_SERVICE_ACCOUNT_EMAIL: 'test', GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'test', YKP_HR_SPREADSHEET_ID: 'test' })).not.toThrow();
  });
});

describe('normalizeEmploymentStatus', () => {
  it('maps Indonesian/dummy variants to canonical tokens', () => {
    expect(normalizeEmploymentStatus('TETAP')).toBe('PERMANENT');
    expect(normalizeEmploymentStatus('PERMANEN')).toBe('PERMANENT');
    expect(normalizeEmploymentStatus('Pegawai Tetap')).toBe('PERMANENT');
    expect(normalizeEmploymentStatus('KONTRAK')).toBe('CONTRACT');
    expect(normalizeEmploymentStatus('PKWT')).toBe('CONTRACT');
    expect(normalizeEmploymentStatus('probasi')).toBe('PROBATION');
    expect(normalizeEmploymentStatus('MASA PROBASI')).toBe('PROBATION');
  });
  it('canonical values pass through untouched', () => {
    for (const s of CANONICAL_STATUSES) expect(normalizeEmploymentStatus(s)).toBe(s);
  });
  it('returns null for unknown/empty — migration leaves them untouched', () => {
    expect(normalizeEmploymentStatus('FREELANCE')).toBeNull();
    expect(normalizeEmploymentStatus('MAGANG')).toBeNull();
    expect(normalizeEmploymentStatus('')).toBeNull();
    expect(normalizeEmploymentStatus(undefined)).toBeNull();
  });
});

describe('labels & dummy detection', () => {
  it('labels match client wording exactly', () => {
    expect(STATUS_LABELS.PROBATION).toBe('Probation');
    expect(STATUS_LABELS.PERMANENT).toBe('Permanent');
    expect(STATUS_LABELS.CONTRACT).toBe('Contract');
  });
  it('flags smoke/dummy outlet names', () => {
    expect(isDummyOutletName('Smoke Test Outlet')).toBe(true);
    expect(isDummyOutletName('Sekar Pizza Colombo')).toBe(false);
  });
});