/**
 * Regression tests for employment-contract date arithmetic.
 *
 * Root cause fixed: parseDate() built WIB-midnight (+07:00) instants while
 * every consumer read them back with UTC getters / toISOString(), shifting
 * ALL derived dates one day back (join 2026-01-10 -> probation 2026-03-09
 * instead of 2026-03-10, and the +1-day contract-start step was swallowed).
 * Fix uses UTC-midnight date-only arithmetic throughout; policy constants
 * (2-month probation, +1 day, 12-month contract, +1 day) are UNCHANGED.
 *
 * Imports the REAL patched file (`../employment-contract.patched.ts`).
 * Deterministic: every case pins todayStr; TZ-independence is asserted by
 * running the same expectations under four host timezones.
 *
 * Run (zero npm deps, Node >= 22):
 *   node --test tests/employment-contract.regression.test.mjs
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

import { computeTimeline, getReminderCandidates } from '../../lib/employment-contract';

describe('contract timeline: exact date expectations (the reported bug)', () => {
  it("join 2024-01-10 -> probation 2024-03-10 (was 2024-03-09 before fix)", () => {
    const tl = computeTimeline('2024-01-10', 'PROBATION', '2024-02-01');
    assert.ok(tl);
    assert.equal(tl.probationEndDate, '2024-03-10');
    assert.equal(tl.contractStartDate, '2024-03-11');
    assert.equal(tl.contractEndDate, '2025-03-11');
    assert.equal(tl.permanentEligibleDate, '2025-03-12');
    assert.equal(tl.currentPhase, 'PROBATION');
    assert.equal(tl.probationDaysTotal, 60);
  });

  it('end-of-month clamp preserved: join 2024-01-31 -> 2024-03-31', () => {
    const tl = computeTimeline('2024-01-31', 'PROBATION', '2024-02-01');
    assert.ok(tl);
    assert.equal(tl.probationEndDate, '2024-03-31');
    assert.equal(tl.contractStartDate, '2024-04-01');
  });

  it('end-of-month clamp preserved: join 2023-08-31 -> 2023-10-31', () => {
    const tl = computeTimeline('2023-08-31', 'PROBATION', '2023-09-01');
    assert.ok(tl);
    assert.equal(tl.probationEndDate, '2023-10-31');
  });

  it('leap-year clamp: join 2023-12-31 -> probation 2024-02-29', () => {
    const tl = computeTimeline('2023-12-31', 'PROBATION', '2024-01-15');
    assert.ok(tl);
    assert.equal(tl.probationEndDate, '2024-02-29');
    assert.equal(tl.contractStartDate, '2024-03-01');
    assert.equal(tl.contractEndDate, '2025-03-01');
  });

  it('leap-day join 2024-02-29 -> probation 2024-04-29', () => {
    const tl = computeTimeline('2024-02-29', 'PROBATION', '2024-03-01');
    assert.ok(tl);
    assert.equal(tl.probationEndDate, '2024-04-29');
  });

  it('policy chain links hold: start = probation+1d, permanent = end+1d', () => {
    const tl = computeTimeline('2024-05-17', 'PROBATION', '2024-06-01');
    assert.ok(tl);
    const d = (s) => Date.parse(`${s}T00:00:00Z`);
    assert.equal(d(tl.contractStartDate) - d(tl.probationEndDate), 86400000);
    assert.equal(d(tl.permanentEligibleDate) - d(tl.contractEndDate), 86400000);
  });

  it('phase transitions on pinned today', () => {
    assert.equal(computeTimeline('2024-01-10', '', '2024-02-01').currentPhase, 'PROBATION');
    assert.equal(computeTimeline('2024-01-10', '', '2024-03-15').currentPhase, 'CONTRACT');
    assert.equal(computeTimeline('2024-01-10', 'PERMANENT', '2024-03-15').currentPhase, 'PERMANENT');
  });
});

describe('override validation (invalid dates fail loudly)', () => {
  it('rejects malformed join date', () => {
    assert.equal(computeTimeline('not-a-date', 'PROBATION', '2024-02-01'), null);
  });

  it('rejects calendar overflow join 2024-02-30 (Date would roll to March)', () => {
    assert.equal(computeTimeline('2024-02-30', 'PROBATION', '2024-02-01'), null);
  });

  it('rejects invalid month 2024-13-01', () => {
    assert.equal(computeTimeline('2024-13-01', 'PROBATION', '2024-02-01'), null);
  });

  it('rejects invalid probation override instead of computing garbage', () => {
    assert.equal(
      computeTimeline('2024-01-10', 'PROBATION', '2024-02-01', { probationEndDate: '2024-02-30' }),
      null,
    );
  });

  it('rejects invalid contract-end override', () => {
    assert.equal(
      computeTimeline('2024-01-10', 'PROBATION', '2024-02-01', { contractEndDate: 'bogus' }),
      null,
    );
  });

  it("blank overrides ('') fall back to policy (columns are blank in seed data)", () => {
    const tl = computeTimeline('2024-01-10', 'PROBATION', '2024-02-01', {
      probationEndDate: '',
      contractStartDate: '',
      contractEndDate: '',
    });
    assert.ok(tl);
    assert.equal(tl.probationEndDate, '2024-03-10');
  });

  it('valid overrides are respected', () => {
    const tl = computeTimeline('2024-01-10', 'PROBATION', '2024-02-01', {
      probationEndDate: '2024-04-01',
    });
    assert.ok(tl);
    assert.equal(tl.probationEndDate, '2024-04-01');
    assert.equal(tl.contractStartDate, '2024-04-02');
  });
});

describe('timezone determinism', () => {
  const zones = ['Pacific/Kiritimati', 'Pacific/Midway', 'UTC', 'Asia/Jakarta'];
  for (const tz of zones) {
    it(`identical timeline under TZ=${tz}`, () => {
      process.env.TZ = tz;
      const tl = computeTimeline('2024-01-10', 'PROBATION', '2024-02-01');
      assert.ok(tl);
      assert.equal(tl.probationEndDate, '2024-03-10');
      assert.equal(tl.contractStartDate, '2024-03-11');
      assert.equal(tl.contractEndDate, '2025-03-11');
      assert.equal(tl.permanentEligibleDate, '2025-03-12');
    });
  }

  it('month-boundary join is stable across the date line', () => {
    const first = (() => {
      process.env.TZ = 'Pacific/Kiritimati';
      return computeTimeline('2024-01-31', 'PROBATION', '2024-02-15');
    })();
    process.env.TZ = 'Pacific/Midway';
    const second = computeTimeline('2024-01-31', 'PROBATION', '2024-02-15');
    assert.deepEqual(second, first);
    assert.equal(second.probationEndDate, '2024-03-31');
  });
});

describe('reminder candidates', () => {
  const emp = (over = {}) => ({
    employee_id: 'EMP-900',
    full_name: 'TestFixed',
    brand_id: 'BR-001',
    outlet_id: 'OL-001',
    join_date: '2024-01-10',
    employment_status: 'PROBATION',
    active_status: 'active',
    probation_end_date: '',
    contract_start_date: '',
    contract_end_date: '',
    ...over,
  });

  it('flags probation ending within 7 days on fixed dates', () => {
    // probation ends 2024-03-10; today 2024-03-07 -> 3 days remaining.
    const out = getReminderCandidates([emp()], '2024-03-07');
    assert.equal(out.length, 1);
    assert.equal(out[0].kind, 'PROBATION_ENDING');
    assert.equal(out[0].targetDate, '2024-03-10');
    assert.equal(out[0].daysRemaining, 3);
  });

  it('skips employees with invalid dates instead of throwing', () => {
    const out = getReminderCandidates([emp({ join_date: '2024-02-30' })], '2024-03-07');
    assert.deepEqual(out, []);
  });

  it('skips inactive employees', () => {
    const out = getReminderCandidates([emp({ active_status: 'inactive' })], '2024-03-07');
    assert.deepEqual(out, []);
  });
});
