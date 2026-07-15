import { env } from '../config/env.js';
import { RISK_LIMITS } from '../config/constants.js';
import { logger } from '../services/logger.js';

export interface RiskInput {
  entry: number;
  sl: number;
  /** Desired RR; default env.RR_TARGET (strategy min 1:3). */
  rrTarget?: number;
  accountUsd?: number;
  riskPct?: number;
  pair?: string;
  /** Setup score 0–100 — gates full vs reduced risk. */
  score?: number;
  /** Open trades already running (strategy max 2–3). */
  openTrades?: number;
  /** Realized PnL % of account for today (negative = loss). */
  dailyPnlPct?: number;
}

export interface RiskResult {
  lots: number;
  riskUsd: number;
  riskPct: number;
  tp: number;
  rr: number;
  allowed: boolean;
  rejectReason?: string;
}

export interface RiskGateInput {
  openTrades: number;
  dailyPnlPct: number;
  riskPct: number;
  rr: number;
  score: number;
}

/**
 * Hard risk gates — ICT_TRADING_STRATEGY.md §8.
 * Pure function, no I/O.
 */
export function evaluateRiskGates(input: RiskGateInput): { ok: boolean; reason?: string } {
  if (input.openTrades >= RISK_LIMITS.MAX_OPEN_TRADES) {
    return {
      ok: false,
      reason: `max open trades ${RISK_LIMITS.MAX_OPEN_TRADES} reached (have ${input.openTrades})`
    };
  }
  if (input.dailyPnlPct <= -RISK_LIMITS.MAX_DAILY_LOSS_PCT) {
    return {
      ok: false,
      reason: `daily loss limit ${RISK_LIMITS.MAX_DAILY_LOSS_PCT}% hit (pnl=${input.dailyPnlPct}%)`
    };
  }
  if (input.rr < RISK_LIMITS.MIN_RR) {
    return {
      ok: false,
      reason: `RR ${input.rr} < min ${RISK_LIMITS.MIN_RR}`
    };
  }
  if (input.riskPct > RISK_LIMITS.MAX_RISK_PCT_PER_TRADE) {
    return {
      ok: false,
      reason: `risk ${input.riskPct}% > max ${RISK_LIMITS.MAX_RISK_PCT_PER_TRADE}%`
    };
  }
  // Over-leverage anti-pattern: risk >1% on score <90
  if (input.score < RISK_LIMITS.FULL_RISK_SCORE && input.riskPct > 1) {
    return {
      ok: false,
      reason: `score ${input.score} < ${RISK_LIMITS.FULL_RISK_SCORE} cannot risk >1% (requested ${input.riskPct}%)`
    };
  }
  return { ok: true };
}

/**
 * Resolve risk % for a setup: full env risk only for A+ scores; else cap at 1%.
 */
export function resolveRiskPct(score: number, requestedPct: number): number {
  const capped = Math.min(requestedPct, RISK_LIMITS.MAX_RISK_PCT_PER_TRADE);
  if (score >= RISK_LIMITS.FULL_RISK_SCORE) return capped;
  return Math.min(capped, 1);
}

/**
 * Compute position size + TP for a setup.
 * For FX majors: 1 standard lot ≈ $10 per pip; pips ≈ |entry-sl| * 10000.
 * Rejects when risk gates fail (max open, daily loss, RR, over-leverage).
 */
export function computeRisk(input: RiskInput): RiskResult {
  const entry = Number(input.entry);
  const sl = Number(input.sl);
  if (!isFinite(entry) || !isFinite(sl) || entry === sl) {
    throw new Error('computeRisk: invalid entry/sl');
  }

  const rrTarget = input.rrTarget ?? env.RR_TARGET;
  const accountUsd = input.accountUsd ?? env.RISK_ACCOUNT_USD;
  const score = input.score ?? 0;
  const requestedPct = input.riskPct ?? env.RISK_PCT_PER_TRADE;
  const riskPct = resolveRiskPct(score, requestedPct);
  const openTrades = input.openTrades ?? 0;
  const dailyPnlPct = input.dailyPnlPct ?? 0;

  const gate = evaluateRiskGates({
    openTrades,
    dailyPnlPct,
    riskPct,
    rr: rrTarget,
    score
  });
  if (!gate.ok) {
    logger.info({ gate, entry, sl, score }, 'risk gate rejected');
    return {
      lots: 0,
      riskUsd: 0,
      riskPct,
      tp: entry,
      rr: rrTarget,
      allowed: false,
      rejectReason: gate.reason
    };
  }

  const direction = entry > sl ? 1 : -1;
  const riskDistance = Math.abs(entry - sl);

  // Approx pip count and pip value for FX majors
  const pips = riskDistance * 10000;
  const riskUsd = (accountUsd * riskPct) / 100;
  const lots = pips > 0 ? riskUsd / (pips * 10) : 0; // $10 per pip per lot

  // Round to 2 decimals, minimum 0.01 when allowed
  const lotsRounded = Math.max(0.01, Math.round(lots * 100) / 100);

  const tp = entry + direction * rrTarget * riskDistance;
  const rr = rrTarget;

  logger.debug({ entry, sl, rrTarget, lots: lotsRounded, tp, riskUsd, riskPct, score }, 'risk computed');
  return { lots: lotsRounded, riskUsd, riskPct, tp, rr, allowed: true };
}
