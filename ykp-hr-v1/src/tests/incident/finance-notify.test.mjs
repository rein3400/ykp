import { vi } from 'vitest';
vi.mock('@/db/sheets', () => import('./stubs/sheets-fake.mjs'));
vi.mock('@/lib/session', () => import('./stubs/session.mjs'));
vi.mock('@/lib/audit', () => import('./stubs/audit.mjs'));
// next/server, zod, http, rbac and format are REAL app modules, not shims.
/**
 * Regression tests for the finance-notify bulk `i + 2` row-identity bug.
 *
 * These tests import the REAL patched production route file
 * (`../route.finance-notify.patched.ts` — deploy by copying over
 * `src/app/api/hr/payroll/finance-notify/route.ts`). Infrastructure seams
 * only are stubbed via tests/loader.mjs: in-memory sheets fake with sparse
 * Postgres-style `__rownum`, null session, no-op audit, NextResponse + zod
 * shims. `@/lib/http`, `@/lib/rbac`, `@/lib/format` are the REAL baseline
 * sources. No real API calls, no network, no DB.
 *
 * Run (zero npm deps, Node >= 22):
 *   node --test --import ./tests/register-loader.mjs tests/finance-notify.regression.test.mjs
 */
import { describe, it, beforeEach } from 'vitest';
import assert from 'node:assert/strict';

import { POST } from '../../app/api/hr/payroll/finance-notify/route';
import {
  TABS,
  __setPayrollRows,
  __setSnapshotRows,
  __setLiveRows,
  __getPayrollRows,
  __updateCalls,
  __findCalls,
} from './stubs/sheets-fake.mjs';
import { __auditCalls } from './stubs/audit.mjs';

const SECRET = 'test-finance-secret';

function authed(body) {
  return new Request('http://localhost/api/hr/payroll/finance-notify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-finance-secret': SECRET },
    body: JSON.stringify(body),
  });
}

function row(pid, period, brand, extra = {}, rownum) {
  return {
    __rownum: rownum,
    payroll_id: pid,
    payroll_period: period,
    brand_id: brand,
    employee_id: `EMP-${pid}`,
    net_salary: '5000000',
    approval_status: 'APPROVED',
    finance_notified_at: '',
    finance_notified_by: '',
    updated_at: '',
    ...extra,
  };
}

beforeEach(() => {
  process.env.FINANCE_NOTIFY_SECRET = SECRET;
  __auditCalls.length = 0;
});

describe('finance-notify bulk path: sparse __rownum identity', () => {
  it('notifies exactly the matching payrolls via stable findRow (gaps 3-4, 6-8)', async () => {
    // __rownum 2,5,9 — rows 3-4 and 6-8 were deleted. Old code wrote i+2 =
    // 2,3,4 (wrong rows / phantom rows) instead of 2 and 5.
    __setPayrollRows([
      row('PR-A', '2026-09', 'BR-001', {}, 2),
      row('PR-B', '2026-09', 'BR-001', {}, 5),
      row('PR-C', '2026-08', 'BR-001', {}, 9),
    ]);
    const res = await POST(authed({ payroll_period: '2026-09' }), { params: Promise.resolve({}) });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.updated, 2);
    assert.deepEqual(
      __updateCalls.map((c) => c.rowNumber),
      [2, 5],
    );
    const live = __getPayrollRows();
    assert.ok(live.find((r) => r.payroll_id === 'PR-A').finance_notified_at);
    assert.ok(live.find((r) => r.payroll_id === 'PR-B').finance_notified_at);
    assert.equal(live.find((r) => r.payroll_id === 'PR-C').finance_notified_at, '');
  });

  it('never writes to the wrong payroll: identity guard on every write', async () => {
    __setPayrollRows([
      row('PR-A', '2026-09', 'BR-001', {}, 2),
      row('PR-B', '2026-09', 'BR-001', {}, 5),
      row('PR-Z', '2026-09', 'BR-001', {}, 7),
    ]);
    await POST(authed({ payroll_period: '2026-09' }), { params: Promise.resolve({}) });
    const live = __getPayrollRows();
    for (const call of __updateCalls) {
      const target = live.find((r) => r.__rownum === call.rowNumber);
      assert.ok(target, `update targeted nonexistent row ${call.rowNumber}`);
      // The written row's own payroll_id must equal the values' payroll_id:
      // a wrong-row overwrite would mismatch here.
      assert.equal(call.values.payroll_id, target.payroll_id);
    }
    assert.equal(__updateCalls.length, 3);
  });

  it('resolves candidates through findRow, not positional index', async () => {
    __setPayrollRows([row('PR-A', '2026-09', 'BR-001', {}, 2), row('PR-B', '2026-09', 'BR-001', {}, 5)]);
    await POST(authed({ payroll_period: '2026-09' }), { params: Promise.resolve({}) });
    assert.deepEqual(
      __findCalls.map((c) => c.value).sort(),
      ['PR-A', 'PR-B'],
    );
  });
});

describe('finance-notify bulk path: business semantics preserved', () => {
  it('honours brand_id filter', async () => {
    __setPayrollRows([
      row('PR-A', '2026-09', 'BR-001', {}, 2),
      row('PR-B', '2026-09', 'BR-002', {}, 5),
    ]);
    const res = await POST(authed({ payroll_period: '2026-09', brand_id: 'BR-002' }), {
      params: Promise.resolve({}),
    });
    const body = await res.json();
    assert.equal(body.data.updated, 1);
    assert.deepEqual(__updateCalls.map((c) => c.rowNumber), [5]);
  });

  it('skips already-notified rows', async () => {
    __setPayrollRows([
      row('PR-A', '2026-09', 'BR-001', { finance_notified_at: '2026-09-01 10:00:00' }, 2),
      row('PR-B', '2026-09', 'BR-001', {}, 5),
    ]);
    const res = await POST(authed({ payroll_period: '2026-09' }), { params: Promise.resolve({}) });
    const body = await res.json();
    assert.equal(body.data.updated, 1);
    assert.deepEqual(__updateCalls.map((c) => c.rowNumber), [5]);
  });

  it('skips snapshot rows with missing payroll_id instead of writing blindly', async () => {
    __setPayrollRows([
      { __rownum: 2, payroll_id: '', payroll_period: '2026-09', brand_id: 'BR-001', finance_notified_at: '' },
      row('PR-B', '2026-09', 'BR-001', {}, 5),
    ]);
    const res = await POST(authed({ payroll_period: '2026-09' }), { params: Promise.resolve({}) });
    const body = await res.json();
    assert.equal(body.data.updated, 1);
    assert.deepEqual(__updateCalls.map((c) => c.rowNumber), [5]);
  });

  it('rechecks FRESH row: concurrently-notified payroll is skipped, not double-written', async () => {
    // Snapshot (what readTab saw) is stale: PR-A looked unnotified.
    __setLiveRows([row('PR-A', '2026-09', 'BR-001', { finance_notified_at: '2026-09-02 09:00:00' }, 2)]);
    __setSnapshotRows([row('PR-A', '2026-09', 'BR-001', {}, 2)]);
    const res = await POST(authed({ payroll_period: '2026-09' }), { params: Promise.resolve({}) });
    const body = await res.json();
    assert.equal(body.data.updated, 0);
    assert.equal(__updateCalls.length, 0);
  });

  it('writes from FRESH fields: concurrent edits are not clobbered by stale snapshot', async () => {
    __setLiveRows([
      row('PR-A', '2026-09', 'BR-001', { approval_status: 'APPROVED', net_salary: '7777777' }, 2),
    ]);
    __setSnapshotRows([
      row('PR-A', '2026-09', 'BR-001', { approval_status: 'DRAFT', net_salary: '1111111' }, 2),
    ]);
    await POST(authed({ payroll_period: '2026-09' }), { params: Promise.resolve({}) });
    assert.equal(__updateCalls.length, 1);
    // Old code spread the STALE snapshot row -> DRAFT/1111111 would win.
    assert.equal(__updateCalls[0].values.approval_status, 'APPROVED');
    assert.equal(__updateCalls[0].values.net_salary, '7777777');
    assert.ok(__updateCalls[0].values.finance_notified_at);
  });

  it('rechecks FRESH row: period changed concurrently is skipped', async () => {
    __setLiveRows([row('PR-A', '2026-10', 'BR-001', {}, 2)]);
    __setSnapshotRows([row('PR-A', '2026-09', 'BR-001', {}, 2)]);
    const res = await POST(authed({ payroll_period: '2026-09' }), { params: Promise.resolve({}) });
    const body = await res.json();
    assert.equal(body.data.updated, 0);
    assert.equal(__updateCalls.length, 0);
  });
});

describe('finance-notify explicit payroll_ids path (regression lock)', () => {
  it('updates by stable id even at sparse __rownum 42', async () => {
    __setPayrollRows([row('PR-X', '2026-09', 'BR-001', {}, 42)]);
    const res = await POST(authed({ payroll_period: '2026-09', payroll_ids: ['PR-X', 'PR-MISSING'] }), {
      params: Promise.resolve({}),
    });
    const body = await res.json();
    assert.equal(body.data.updated, 1);
    assert.deepEqual(__updateCalls.map((c) => c.rowNumber), [42]);
  });
});

describe('finance-notify auth + validation passthrough', () => {
  it('rejects unauthenticated calls (no secret, no session)', async () => {
    __setPayrollRows([row('PR-A', '2026-09', 'BR-001', {}, 2)]);
    const req = new Request('http://localhost/api/hr/payroll/finance-notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payroll_period: '2026-09' }),
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    assert.equal(res.status, 401);
    assert.equal(__updateCalls.length, 0);
  });

  it('rejects malformed payroll_period', async () => {
    const res = await POST(authed({ payroll_period: 'september' }), { params: Promise.resolve({}) });
    assert.equal(res.status, 400);
  });

  it('writes an audit entry per call', async () => {
    __setPayrollRows([row('PR-A', '2026-09', 'BR-001', {}, 2)]);
    await POST(authed({ payroll_period: '2026-09' }), { params: Promise.resolve({}) });
    assert.equal(__auditCalls.length, 1);
    assert.equal(__auditCalls[0].action, 'finance_notify_transfer');
    assert.equal(__auditCalls[0].entityId, '2026-09');
  });
});

assert.equal(TABS.payroll, 'hr_payroll');
