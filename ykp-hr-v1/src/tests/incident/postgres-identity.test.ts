/** Real PostgreSQL regression using one connection and transaction-local temporary tables only. */
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getPgPool } from '@/db/postgres';
import { TABS, TAB_HEADERS } from '@/db/sheets';
import { POST } from '@/app/api/hr/payroll/finance-notify/route';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(async () => null) }));
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => undefined) }));
const enabled = process.env.YKP_TEMP_DB_TEST === 'true';
let transaction = false;
const q = (name: string): string => '"' + name.replace(/"/g, '""') + '"';

beforeAll(async () => {
  if (!enabled) return;
  if (process.env.PG_POOL_MAX !== '1' || process.env.USE_POSTGRES !== 'true') throw new Error('TEMP_TEST_REQUIRES_SINGLE_PG_CONNECTION');
  process.env.FINANCE_NOTIFY_SECRET = 'isolated-unit-fixture-only';
  const pool = getPgPool();
  await pool.query('BEGIN');
  transaction = true;
  await pool.query("SET LOCAL statement_timeout='5s'");
  await pool.query(`CREATE TEMP TABLE ${q(TABS.payroll)} (__rownum BIGINT PRIMARY KEY, ${TAB_HEADERS[TABS.payroll].map(h => q(h)+" TEXT NOT NULL DEFAULT ''").join(',')}) ON COMMIT DROP`);
  const relation = await pool.query('SELECT relpersistence, relnamespace = pg_my_temp_schema() AS is_temp FROM pg_class WHERE oid = $1::regclass', [TABS.payroll]);
  if (relation.rows[0]?.relpersistence !== 't' || !relation.rows[0]?.is_temp) throw new Error('TEMP_RELATION_GUARD_FAILED');
  await pool.query(`INSERT INTO ${q(TABS.payroll)} (__rownum,payroll_id,payroll_period,brand_id,employee_id,net_salary) VALUES (2,'QA-A','2026-09','QA-BRAND','QA-EMP-A','100'),(5,'QA-B','2026-09','QA-BRAND','QA-EMP-B','200'),(9,'QA-SENTINEL','2026-08','QA-BRAND','QA-EMP-C','300')`);
});

afterAll(async () => {
  if (!enabled) return;
  const pool = getPgPool();
  try { if (transaction) await pool.query('ROLLBACK'); } finally { await pool.end(); }
});

it.skipIf(!enabled)('actual route updates only correct sparse PostgreSQL identities and preserves untouched payroll', async () => {
  const req = new NextRequest('http://localhost/api/hr/payroll/finance-notify', { method: 'POST', headers: { 'content-type': 'application/json', 'x-finance-secret': 'isolated-unit-fixture-only' }, body: JSON.stringify({ payroll_period: '2026-09', brand_id: 'QA-BRAND' }) });
  const response = await POST(req, { params: Promise.resolve({}) });
  expect(response.status).toBe(200);
  expect((await response.json()).data.updated).toBe(2);
  const rows = (await getPgPool().query(`SELECT __rownum,payroll_id,employee_id,net_salary,finance_notified_at FROM ${q(TABS.payroll)} ORDER BY __rownum`)).rows;
  expect(rows.map(r => [r.__rownum,r.payroll_id,r.employee_id,r.net_salary])).toEqual([['2','QA-A','QA-EMP-A','100'],['5','QA-B','QA-EMP-B','200'],['9','QA-SENTINEL','QA-EMP-C','300']]);
  expect(rows[0].finance_notified_at).not.toBe('');
  expect(rows[1].finance_notified_at).not.toBe('');
  expect(rows[2].finance_notified_at).toBe('');
});
