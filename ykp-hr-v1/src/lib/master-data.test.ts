import { describe, it, expect } from 'vitest';
import {
  REAL_OUTLETS, CANONICAL_STATUSES, STATUS_LABELS,
  normalizeEmploymentStatus, isDummyOutletName
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