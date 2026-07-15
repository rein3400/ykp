import { describe, it, expect, vi } from 'vitest';
import {
  computeRisk,
  evaluateRiskGates,
  resolveRiskPct
} from '../src/modules/risk-manager.js';
import { RISK_LIMITS } from '../src/config/constants.js';

vi.mock('../src/config/env.js', () => ({
  env: {
    RISK_ACCOUNT_USD: 10000,
    RISK_PCT_PER_TRADE: 1,
    RR_TARGET: 3
  }
}));
vi.mock('../src/services/logger.js', () => ({
  logger: { debug: () => {}, info: () => {}, warn: () => {} }
}));

describe('RISK_LIMITS (strategy §8)', () => {
  it('encodes min RR 3, max risk 2%, daily loss 5%, max open 3', () => {
    expect(RISK_LIMITS.MIN_RR).toBe(3);
    expect(RISK_LIMITS.MAX_RISK_PCT_PER_TRADE).toBe(2);
    expect(RISK_LIMITS.MAX_DAILY_LOSS_PCT).toBe(5);
    expect(RISK_LIMITS.MAX_OPEN_TRADES).toBe(3);
  });
});

describe('evaluateRiskGates', () => {
  it('rejects when open trades at max', () => {
    const r = evaluateRiskGates({
      openTrades: 3,
      dailyPnlPct: 0,
      riskPct: 1,
      rr: 3,
      score: 95
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/max open trades/i);
  });

  it('rejects when daily loss hit', () => {
    const r = evaluateRiskGates({
      openTrades: 0,
      dailyPnlPct: -5,
      riskPct: 1,
      rr: 3,
      score: 95
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/daily loss/i);
  });

  it('rejects RR below 3', () => {
    const r = evaluateRiskGates({
      openTrades: 0,
      dailyPnlPct: 0,
      riskPct: 1,
      rr: 2,
      score: 95
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/RR/i);
  });

  it('rejects >1% risk on score <90', () => {
    const r = evaluateRiskGates({
      openTrades: 0,
      dailyPnlPct: 0,
      riskPct: 1.5,
      rr: 3,
      score: 85
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/cannot risk/i);
  });

  it('allows A+ full risk within caps', () => {
    const r = evaluateRiskGates({
      openTrades: 1,
      dailyPnlPct: -1,
      riskPct: 2,
      rr: 3,
      score: 95
    });
    expect(r.ok).toBe(true);
  });
});

describe('resolveRiskPct', () => {
  it('caps non-A+ at 1%', () => {
    expect(resolveRiskPct(80, 2)).toBe(1);
  });
  it('allows up to 2% for A+', () => {
    expect(resolveRiskPct(95, 2)).toBe(2);
  });
});

describe('computeRisk', () => {
  it('returns positive lots and RR >= 3 for valid A+ input', () => {
    const entry = 1.1;
    const r = computeRisk({
      entry,
      sl: 1.095,
      rrTarget: 3,
      accountUsd: 10000,
      riskPct: 1,
      score: 95,
      openTrades: 0,
      dailyPnlPct: 0
    });
    expect(r.allowed).toBe(true);
    expect(r.lots).toBeGreaterThan(0);
    expect(r.rr).toBe(3);
    expect(r.tp).toBeGreaterThan(entry);
  });

  it('TP below entry for SELL direction', () => {
    const r = computeRisk({
      entry: 1.1,
      sl: 1.105,
      rrTarget: 3,
      accountUsd: 10000,
      riskPct: 1,
      score: 95
    });
    expect(r.allowed).toBe(true);
    expect(r.tp).toBeLessThan(1.1);
  });

  it('throws on equal entry/sl', () => {
    expect(() => computeRisk({ entry: 1.1, sl: 1.1 })).toThrow();
  });

  it('rejects when daily loss already hit', () => {
    const r = computeRisk({
      entry: 1.1,
      sl: 1.095,
      rrTarget: 3,
      score: 95,
      dailyPnlPct: -5.5
    });
    expect(r.allowed).toBe(false);
    expect(r.lots).toBe(0);
    expect(r.rejectReason).toMatch(/daily loss/i);
  });
});
