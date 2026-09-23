import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mock handle: the factory below runs lazily, so the indirection
// must not reference top-level bindings directly.
const { readTabMock } = vi.hoisted(() => ({ readTabMock: vi.fn() }));

// Minimal contract fixture (lengths mirror production sheets.ts for these tabs).
vi.mock('@/db/sheets', () => ({
  TABS: { brands: 'master_brand', employees: 'master_employee' },
  TAB_HEADERS: {
    master_brand: [
      'brand_id',
      'brand_name',
      'brand_code',
      'email',
      'status',
      'created_at',
      'updated_at',
      'created_by',
      'updated_by'
    ],
    master_employee: ['employee_id', 'full_name', 'email']
  },
  readTab: (...args: unknown[]) => readTabMock(...args)
}));

// Import the ACTUAL patched route under test — no duplicated logic.
import { GET } from './route';

const SECRET = 'SECRET-TOKEN-9f8a7b';
const PII = 'operator-pii-07@example.com';

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  readTabMock.mockReset();
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe('GET /api/hr/summary/count (truthful health contract)', () => {
  it('all healthy -> 200, legacy data.tabs+total shape, status ok', async () => {
    readTabMock.mockImplementation(async (tab: string) =>
      tab === 'master_brand' ? [{}, {}] : [{}]
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.failed).toBeUndefined();
    expect(body.data.tabs).toEqual([
      { name: 'master_brand', columns: 9, rows: 2 },
      { name: 'master_employee', columns: 3, rows: 1 }
    ]);
    expect(body.data.total).toBe(3);
  });

  it('one tab fails -> 503 degraded, valid tabs intact, failed columns not zeroed', async () => {
    readTabMock.mockImplementation(async (tab: string) => {
      if (tab === 'master_employee') throw new Error('boom');
      return [{}, {}];
    });
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('degraded');
    expect(body.failed).toEqual(['master_employee']);
    // Valid tab keeps real counts — never blanked.
    expect(body.data.tabs).toContainEqual({ name: 'master_brand', columns: 9, rows: 2 });
    // Failed tab keeps contracted columns (not 0 => not a healthy empty table).
    expect(body.data.tabs).toContainEqual({ name: 'master_employee', columns: 3, rows: 0 });
    // Total is a partial sum over readable tabs.
    expect(body.data.total).toBe(2);
  });

  it('leaks no raw DB errors or PII in body or server log', async () => {
    readTabMock.mockRejectedValue(
      new Error(`column "probation_end_date" does not exist ${SECRET} ${PII}`)
    );
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    const text = JSON.stringify(body);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(PII);
    expect(text).not.toContain('does not exist');
    // failed[] carries tab identifiers only.
    expect(body.failed).toEqual(['master_brand', 'master_employee']);
    // Server log is sanitized to tab names only.
    const logged = consoleSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain(PII);
    expect(logged).not.toContain('does not exist');
  });
});
