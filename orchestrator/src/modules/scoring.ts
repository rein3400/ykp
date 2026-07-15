import { SCORING_WEIGHTS, RISK_LIMITS } from '../config/constants.js';
import { env } from '../config/env.js';

export interface ScoringInput {
  bias: string;
  dolSide: string;
  sweep: string;
  mss: string;
  ifvg: string;
  smt: string;
  silverBullet: boolean;
  premiumDiscount?: string;
  pdArray?: string;
  sessionOk: boolean;
  newsOk: boolean;
  /** Planned RR (risk:reward). Component scores full 15 only if ≥ MIN_RR. */
  rr?: number;
  /** Optional quality flags for partial credit (clean sweep, confirmed MSS). */
  quality?: {
    cleanSweep?: boolean;
    mssConfirmed?: boolean;
    ifvgClean?: boolean;
  };
}

export interface ScoreBreakdown {
  htfAlign: number;
  sweep: number;
  mss: number;
  ifvg: number;
  rr: number;
  session: number;
  newsClear: number;
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  passed: boolean;
  /** True when score ≥ RISK_LIMITS.FULL_RISK_SCORE (A+ setup). */
  fullRiskEligible: boolean;
}

function isHtfAligned(s: ScoringInput): boolean {
  if (!s.bias || !s.mss || !s.ifvg) return false;
  if (!(s.bias === s.mss && s.mss === s.ifvg)) return false;
  // DOL should agree with bias when present
  if (s.dolSide) {
    if (s.bias === 'bull' && s.dolSide !== 'buy') return false;
    if (s.bias === 'bear' && s.dolSide !== 'sell') return false;
  }
  return true;
}

function sweepSideOk(s: ScoringInput): boolean {
  if (!s.sweep || !s.bias) return false;
  if (s.bias === 'bull') return s.sweep === 'ssl';
  if (s.bias === 'bear') return s.sweep === 'bsl';
  return false;
}

/**
 * Pure scoring rubric per ICT_TRADING_STRATEGY.md §4.
 * Weights (sum=100): HTF 25, sweep 15, MSS 15, IFVG 15, RR 15, session 10, news 5.
 * Hard gates must already have passed; this grades quality, not permission.
 */
export function scoreSetup(input: ScoringInput): ScoreResult {
  const w = SCORING_WEIGHTS;
  const minRr = RISK_LIMITS.MIN_RR;
  const q = input.quality ?? {};

  const breakdown: ScoreBreakdown = {
    htfAlign: 0,
    sweep: 0,
    mss: 0,
    ifvg: 0,
    rr: 0,
    session: 0,
    newsClear: 0
  };

  if (isHtfAligned(input)) {
    breakdown.htfAlign = w.htfAlign;
  }

  if (sweepSideOk(input)) {
    // Full points for clean sweep; half if flag says noisy/thin touch
    const clean = q.cleanSweep !== false;
    breakdown.sweep = clean ? w.sweep : Math.floor(w.sweep / 2);
  }

  if (input.mss && input.bias === input.mss) {
    const confirmed = q.mssConfirmed !== false;
    breakdown.mss = confirmed ? w.mss : Math.floor(w.mss / 2);
  }

  if (input.ifvg && input.bias === input.ifvg) {
    const clean = q.ifvgClean !== false;
    breakdown.ifvg = clean ? w.ifvg : Math.floor(w.ifvg / 2);
  }

  const rr = typeof input.rr === 'number' ? input.rr : 0;
  if (rr >= minRr) {
    // Full 15 at ≥1:3; scale down toward 0 between 1:2 and 1:3 (still partial credit)
    if (rr >= minRr) breakdown.rr = w.rr;
  } else if (rr >= 2) {
    breakdown.rr = Math.floor(w.rr * ((rr - 2) / (minRr - 2)) * 0.5);
  }

  if (input.sessionOk) breakdown.session = w.session;
  if (input.newsOk) breakdown.newsClear = w.newsClear;

  // Optional boosts that do NOT exceed 100 (cap): silver bullet / SMT already reflected
  // in structure completeness; no extra points beyond rubric.

  const score =
    breakdown.htfAlign +
    breakdown.sweep +
    breakdown.mss +
    breakdown.ifvg +
    breakdown.rr +
    breakdown.session +
    breakdown.newsClear;

  const capped = Math.min(100, score);
  return {
    score: capped,
    breakdown,
    passed: capped >= env.SCORE_THRESHOLD,
    fullRiskEligible: capped >= RISK_LIMITS.FULL_RISK_SCORE
  };
}
