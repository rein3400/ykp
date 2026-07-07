import { env } from '../config/env.js';
import { logger } from '../services/logger.js';

export interface RiskInput {
  entry: number;
  sl: number;
  rrTarget?: number;
  accountUsd?: number;
  riskPct?: number;
  pair?: string; // used for future ATR/pipValue lookup
}

export interface RiskResult {
  lots: number;
  riskUsd: number;
  tp: number;
  rr: number;
}

/**
 * Compute position size + TP for a setup.
 * For FX pairs, pip value is approximated: 1 standard lot = $10 per pip.
 * SL/entry are absolute prices, so risk distance is |entry - sl| * 10000 (rough pip count for major FX).
 */
export function computeRisk(input: RiskInput): RiskResult {
  const entry = Number(input.entry);
  const sl = Number(input.sl);
  if (!isFinite(entry) || !isFinite(sl) || entry === sl) {
    throw new Error('computeRisk: invalid entry/sl');
  }

  const rrTarget = input.rrTarget ?? env.RR_TARGET;
  const accountUsd = input.accountUsd ?? env.RISK_ACCOUNT_USD;
  const riskPct = input.riskPct ?? env.RISK_PCT_PER_TRADE;

  const direction = entry > sl ? 1 : -1;
  const riskDistance = Math.abs(entry - sl);

  // Approx pip count and pip value for FX majors
  const pips = riskDistance * 10000;
  const riskUsd = (accountUsd * riskPct) / 100;
  const lots = pips > 0 ? riskUsd / (pips * 10) : 0; // $10 per pip per lot

  // Round to 2 decimals, minimum 0.01
  const lotsRounded = Math.max(0.01, Math.round(lots * 100) / 100);

  const tp = entry + direction * rrTarget * riskDistance;
  const rr = rrTarget;

  logger.debug({ entry, sl, rrTarget, lots: lotsRounded, tp, riskUsd }, 'risk computed');
  return { lots: lotsRounded, riskUsd, tp, rr };
}
