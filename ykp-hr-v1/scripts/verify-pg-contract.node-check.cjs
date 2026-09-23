'use strict';
/**
 * Offline regression tests for the deploy gate. Stdlib only (node:test +
 * node:assert) with a mocked pg client — no database, no installs.
 * Imports the ACTUAL verifier under test; no duplicated check logic.
 *
 * Run from the app dir (after applying the patch):
 *   node --test scripts/verify-pg-contract.test.cjs
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  quoteIdent,
  sanitizePgError,
  checkEnv,
  extractContractFromSource,
  verifyWithClient
} = require('./verify-pg-contract.cjs');

const SECRET = 'SECRET-TOKEN-9f8a7b';
const PII = 'operator-pii-07@example.com';

const TABS = { brands: 'master_brand', employees: 'master_employee' };
const TAB_HEADERS = {
  master_brand: ['brand_id', 'brand_name', 'email'],
  master_employee: ['employee_id', 'full_name']
};

/** Fake pg client that emulates information_schema + LIMIT 0 probe semantics. */
function makeFakeClient({ present = {}, failSelect = {} } = {}) {
  const queries = [];
  const infoRows = [];
  for (const [tab, cols] of Object.entries(present)) {
    for (const c of cols) infoRows.push({ table_name: tab, column_name: c });
  }
  return {
    queries,
    ended: false,
    async query(sql) {
      queries.push(sql);
      if (/^\s*SET\b/i.test(sql)) return { rows: [] };
      if (/information_schema/i.test(sql)) return { rows: infoRows };
      const tabMatch = sql.match(/FROM "([^"]+)"/);
      const tab = tabMatch && tabMatch[1];
      if (failSelect[tab]) {
        const e = new Error(`injected failure ${SECRET} ${PII}`);
        e.code = failSelect[tab];
        throw e;
      }
      const fromIdx = sql.indexOf(' FROM "');
      const colsPart = sql.slice('SELECT '.length, fromIdx);
      const selected = colsPart.split(',').map((s) => s.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      const have = new Set(present[tab] || []);
      const missingCol =
        selected.find((c) => !have.has(c)) || (/ORDER BY "__rownum"/.test(sql) && !have.has('__rownum') ? '__rownum' : null);
      if (missingCol) {
        const e = new Error(`column "${missingCol}" does not exist ${SECRET} ${PII}`);
        e.code = '42703';
        throw e;
      }
      return { rows: [] };
    },
    async end() {
      this.ended = true;
    }
  };
}

const WRITE_RE = /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i;

describe('quoteIdent / sanitizePgError (pure)', () => {
  it('quotes identifiers and escapes double quotes', () => {
    assert.equal(quoteIdent('master_brand'), '"master_brand"');
    assert.equal(quoteIdent('a"b'), '"a""b"');
    assert.throws(() => quoteIdent(''), /INVALID_IDENTIFIER/);
  });

  it('keeps valid SQLSTATE codes, maps anything else, never leaks messages', () => {
    assert.equal(sanitizePgError({ code: '42703', message: SECRET }), '42703');
    assert.equal(sanitizePgError({ code: 'nope!', message: SECRET }), 'QUERY_FAILED');
    assert.equal(sanitizePgError(new Error(SECRET)), 'QUERY_FAILED');
    assert.equal(sanitizePgError(null), 'QUERY_FAILED');
  });
});

describe('checkEnv (deploy guard)', () => {
  it('refuses when USE_POSTGRES is not true, without echoing credentials', () => {
    const env = { USE_POSTGRES: 'false', DATABASE_URL: `postgres://u:${SECRET}@db:5432/ykp_v1` };
    assert.throws(() => checkEnv(env), (e) => {
      assert.equal(e.code, 'USE_POSTGRES_NOT_ENABLED');
      assert.ok(!String(e.message).includes(SECRET));
      return true;
    });
  });

  it('refuses when DATABASE_URL is missing', () => {
    assert.throws(() => checkEnv({ USE_POSTGRES: 'true' }), (e) => e.code === 'DATABASE_URL_MISSING');
  });

  it('accepts a caller-provided postgres URL and returns it opaquely', () => {
    const url = 'postgres://user:pass@some-host:5432/some_db';
    assert.equal(checkEnv({ USE_POSTGRES: 'TrUe', DATABASE_URL: url }), url);
  });
});

describe('verifyWithClient (mocked pg)', () => {
  it('all healthy -> ok:true, every tab checked', async () => {
    const client = makeFakeClient({
      present: {
        master_brand: ['brand_id', 'brand_name', 'email', '__rownum'],
        master_employee: ['employee_id', 'full_name', '__rownum']
      }
    });
    const res = await verifyWithClient(client, TABS, TAB_HEADERS);
    assert.equal(res.ok, true);
    assert.equal(res.checked, 2);
    assert.deepEqual(res.failed, []);
  });

  it('missing column fails that tab with 42703 and leaks no PII', async () => {
    const client = makeFakeClient({
      present: {
        master_brand: ['brand_id', 'brand_name', '__rownum'], // email absent
        master_employee: ['employee_id', 'full_name', '__rownum']
      }
    });
    const res = await verifyWithClient(client, TABS, TAB_HEADERS);
    assert.equal(res.ok, false);
    assert.equal(res.failed.length, 1);
    assert.equal(res.failed[0].tab, 'master_brand');
    assert.deepEqual(res.failed[0].missing, ['email']);
    assert.equal(res.failed[0].selectOk, false);
    assert.equal(res.failed[0].sqlstate, '42703');
    const text = JSON.stringify(res);
    assert.ok(!text.includes(SECRET) && !text.includes(PII));
  });

  it('missing __rownum alone is a failure', async () => {
    const client = makeFakeClient({
      present: {
        master_brand: ['brand_id', 'brand_name', 'email', '__rownum'],
        master_employee: ['employee_id', 'full_name'] // __rownum absent
      }
    });
    const res = await verifyWithClient(client, TABS, TAB_HEADERS);
    assert.equal(res.ok, false);
    assert.equal(res.failed.length, 1);
    assert.ok(res.failed[0].missing.includes('__rownum'));
  });

  it('SELECT probe failure is sanitized to its code (message/PII dropped)', async () => {
    const client = makeFakeClient({
      present: {
        master_brand: ['brand_id', 'brand_name', 'email', '__rownum'],
        master_employee: ['employee_id', 'full_name', '__rownum']
      },
      failSelect: { master_employee: '42P01' }
    });
    const res = await verifyWithClient(client, TABS, TAB_HEADERS);
    assert.equal(res.ok, false);
    assert.deepEqual(res.failed[0].missing, []);
    assert.equal(res.failed[0].selectOk, false);
    assert.equal(res.failed[0].sqlstate, '42P01');
    assert.ok(!JSON.stringify(res).includes(SECRET));
  });

  it('reports EVERY failing tab, not just the first', async () => {
    const client = makeFakeClient({
      present: { master_brand: ['brand_id', '__rownum'], master_employee: ['employee_id', '__rownum'] }
    });
    const res = await verifyWithClient(client, TABS, TAB_HEADERS);
    assert.equal(res.failed.length, 2);
  });

  it('session is read-only and issues no writes', async () => {
    const client = makeFakeClient({
      present: {
        master_brand: ['brand_id', 'brand_name', 'email', '__rownum'],
        master_employee: ['employee_id', 'full_name', '__rownum']
      }
    });
    await verifyWithClient(client, TABS, TAB_HEADERS);
    assert.ok(client.queries.some((q) => q === 'SET default_transaction_read_only=on'));
    assert.ok(client.queries.every((q) => !WRITE_RE.test(q)));
    assert.ok(client.queries.every((q) => /^(SET|SELECT)\b/i.test(q)));
  });
});

describe('extractContractFromSource', () => {
  it('requires the typescript module (no silent regex fallback)', () => {
    assert.throws(() => extractContractFromSource('const TABS = {};', null), (e) => e.code === 'TYPESCRIPT_NOT_AVAILABLE');
  });

  it('extracts actual TABS/TAB_HEADERS via the TS AST (skips if typescript absent)', async (t) => {
    let ts;
    try {
      ts = require('typescript');
    } catch (_ignored) {
      t.skip('typescript not installed in this offline env; runs on the VPS app dir');
      return;
    }
    const fixture = `
      export const TABS = { brands: 'master_brand', employees: 'master_employee' } as const;
      export type TabName = (typeof TABS)[keyof typeof TABS];
      export const TAB_HEADERS: Record<string, string[]> = {
        [TABS.brands]: ['brand_id', 'email'],
        [TABS.employees]: ['employee_id', 'probation_end_date'],
      };
      export async function readTab() { return []; }
    `;
    const { TABS: gotTabs, TAB_HEADERS: gotHeaders } = extractContractFromSource(fixture, ts);
    assert.equal(gotTabs.brands, 'master_brand');
    // VM arrays have a distinct realm prototype; assert their values in this realm.
    assert.deepEqual(Array.from(gotHeaders.master_brand), ['brand_id', 'email']);
    assert.deepEqual(Array.from(gotHeaders.master_employee), ['employee_id', 'probation_end_date']);
    assert.throws(() => extractContractFromSource('const X = 1;', ts), (e) => e.code === 'CONTRACT_CONSTANTS_UNRECOGNIZED');
  });
});
