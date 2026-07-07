import { describe, it, expect, vi } from 'vitest';
import { computeRisk } from '../src/modules/risk-manager.js';

vi.mock('../src/config/env.js', () => ({
  env: {
    RISK_ACCOUNT_USD: 10000,
    RISK_PCT_PER_TRADE: 0.5,
    RR_TARGET: 2
  }
}));
vi.mock('../src/services/logger.js', () => ({ logger: { debug: () => {} } }));

describe('computeRisk', () => {
  it('returns positive lots and RR >= 2 for valid input', () => {
    const entry = 1.1;
    const r = computeRisk({ entry, sl: 1.095, rrTarget: 2, accountUsd: 10000, riskPct: 0.5 });
    expect(r.lots).toBeGreaterThan(0);
    expect(r.rr).toBe(2);
    expect(r.tp).toBeGreaterThan(entry);
  });

  it('TP below entry for SELL direction', () => {
    const r = computeRisk({ entry: 1.1, sl: 1.105, rrTarget: 2, accountUsd: 10000, riskPct: 0.5 });
    expect(r.tp).toBeLessThan(1.1);
  });

  it('throws on equal entry/sl', () => {
    expect(() => computeRisk({ entry: 1.1, sl: 1.1 })).toThrow();
  });
});