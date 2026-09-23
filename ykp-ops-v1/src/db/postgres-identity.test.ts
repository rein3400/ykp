/**
 * OPS PostgreSQL stable-identity regression tests.
 *
 * Exercises the ACTUAL sheets.ts findRow/updateRow against an in-memory
 * pg I/O boundary that mirrors the real adapter contract
 * (src/db/postgres.ts): UPDATE ... WHERE __rownum = $1,
 * pgFindRow returns { rowNumber: __rownum }.
 * No live database. USE_MOCK_DB is off so the PG branch is taken;
 * the ./postgres module itself is mocked at the boundary only.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

type Row = Record<string, unknown>;

const pgBoundary = vi.hoisted(() => ({
  rows: [] as Row[],
  writes: [] as Array<{ rowNumber: number; incidentId: string }>,
}));

vi.mock('./postgres', () => ({
  isPostgresMode: () => true,
  pgReadTab: async () =>
    pgBoundary.rows.map(({ __rownum: _drop, ...row }) => ({ ...row })),
  pgAppendRows: async () => -1,
  pgUpdateRow: async (
    _tab: string,
    _headers: string[],
    rowNumber: number,
    row: Record<string, string>,
  ) => {
    pgBoundary.writes.push({ rowNumber, incidentId: row.incident_id });
    const dest = pgBoundary.rows.find((r) => r.__rownum === rowNumber);
    if (dest) Object.assign(dest, row);
  },
  pgFindRow: async (
    _tab: string,
    _headers: string[],
    column: string,
    value: string,
  ) => {
    const found = pgBoundary.rows.find((r) => r[column] === value);
    if (!found) return null;
    const { __rownum, ...row } = found;
    return { rowNumber: __rownum as number, row: { ...(row as Record<string, string>) } };
  },
}));

import { findRow, updateRow, TABS } from './sheets';

const savedEnv: Record<string, string | undefined> = {};

function seed(rows: Array<{ __rownum: number; incident_id: string; status: string }>) {
  pgBoundary.rows = rows.map((r) => ({ ...r }));
  pgBoundary.writes = [];
}

beforeEach(() => {
  savedEnv.USE_MOCK_DB = process.env.USE_MOCK_DB;
  savedEnv.GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  savedEnv.YKP_OPS_SPREADSHEET_ID = process.env.YKP_OPS_SPREADSHEET_ID;
  // Force sheets.ts past the mock branch into the (mocked) postgres branch.
  process.env.USE_MOCK_DB = 'false';
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'synthetic-test@example.iam.gserviceaccount.com';
  process.env.YKP_OPS_SPREADSHEET_ID = 'synthetic-spreadsheet-id';
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('postgres stable identity with gapped __rownum', () => {
  it('updates gapped row 3 (INC-B) without touching row 2 (INC-A)', async () => {
    seed([
      { __rownum: 2, incident_id: 'INC-A', status: 'open' },
      { __rownum: 3, incident_id: 'INC-B', status: 'open' },
      { __rownum: 5, incident_id: 'INC-C', status: 'open' },
    ]);
    const found = await findRow(TABS.incidents, 'incident_id', 'INC-B');
    expect(found).not.toBeNull();
    expect(found!.rowIndex).toBe(3);
    await updateRow(TABS.incidents, found!.rowIndex, { ...found!.row, status: 'resolved' });
    expect(pgBoundary.writes).toHaveLength(1);
    expect(pgBoundary.writes[0].rowNumber).toBe(3);
    expect(pgBoundary.rows[0].incident_id).toBe('INC-A');
    expect(pgBoundary.rows[0].status).toBe('open');
    expect(pgBoundary.rows[1].status).toBe('resolved');
    expect(pgBoundary.rows[2].status).toBe('open');
  });

  it('updates row 5 after deletes leave gaps (rows 2,5 only)', async () => {
    seed([
      { __rownum: 2, incident_id: 'INC-A', status: 'open' },
      { __rownum: 5, incident_id: 'INC-C', status: 'open' },
    ]);
    const found = await findRow(TABS.incidents, 'incident_id', 'INC-C');
    expect(found).not.toBeNull();
    expect(found!.rowIndex).toBe(5);
    await updateRow(TABS.incidents, found!.rowIndex, { ...found!.row, status: 'resolved' });
    expect(pgBoundary.writes).toHaveLength(1);
    expect(pgBoundary.writes[0].rowNumber).toBe(5);
    expect(pgBoundary.rows[0].incident_id).toBe('INC-A');
    expect(pgBoundary.rows[0].status).toBe('open');
    expect(pgBoundary.rows[1].status).toBe('resolved');
  });

  it('returns null for a missing key instead of a dense guess', async () => {
    seed([{ __rownum: 2, incident_id: 'INC-A', status: 'open' }]);
    const found = await findRow(TABS.incidents, 'incident_id', 'INC-X');
    expect(found).toBeNull();
    expect(pgBoundary.writes).toHaveLength(0);
  });

  it('contiguous control: middle of rows 2,3,4 updates row 3 only', async () => {
    seed([
      { __rownum: 2, incident_id: 'INC-A', status: 'open' },
      { __rownum: 3, incident_id: 'INC-B', status: 'open' },
      { __rownum: 4, incident_id: 'INC-C', status: 'open' },
    ]);
    const found = await findRow(TABS.incidents, 'incident_id', 'INC-B');
    expect(found).not.toBeNull();
    expect(found!.rowIndex).toBe(3);
    await updateRow(TABS.incidents, found!.rowIndex, { ...found!.row, status: 'resolved' });
    expect(pgBoundary.writes).toHaveLength(1);
    expect(pgBoundary.writes[0].rowNumber).toBe(3);
    expect(pgBoundary.rows[0].status).toBe('open');
    expect(pgBoundary.rows[1].status).toBe('resolved');
    expect(pgBoundary.rows[2].status).toBe('open');
  });
});
