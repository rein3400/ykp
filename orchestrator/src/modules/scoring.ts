import { SCORING_WEIGHTS } from '../config/constants.js';
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
}

export interface ScoreBreakdown {
  biasAlign: number;
  sweep: number;
  mss: number;
  ifvg: number;
  session: number;
  newsClear: number;
  smt: number;
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  passed: boolean;
}

function isAligned(s: { bias: string; mss: string; ifvg: string }): boolean {
  if (!s.bias || !s.mss || !s.ifvg) return false;
  return s.bias === s.mss && s.mss === s.ifvg;
}

/**
 * Pure scoring rubric per HERMES brief.
 * Weights (sum=100): biasAlign 20, sweep 15, mss 20, ifvg 20, session 10, newsClear 10, smt 5.
 */
export function scoreSetup(input: ScoringInput): ScoreResult {
  const w = SCORING_WEIGHTS;
  const breakdown: ScoreBreakdown = {
    biasAlign: 0,
    sweep: 0,
    mss: 0,
    ifvg: 0,
    session: 0,
    newsClear: 0,
    smt: 0
  };

  if (isAligned(input)) breakdown.biasAlign = w.biasAlign;
  if (input.sweep) breakdown.sweep = w.sweep;
  if (input.mss) breakdown.mss = w.mss;
  if (input.ifvg) breakdown.ifvg = w.ifvg;
  if (input.sessionOk) breakdown.session = w.session;
  if (input.newsOk) breakdown.newsClear = w.newsClear;
  if (input.smt) breakdown.smt = w.smt;

  const score = breakdown.biasAlign + breakdown.sweep + breakdown.mss + breakdown.ifvg + breakdown.session + breakdown.newsClear + breakdown.smt;
  return { score, breakdown, passed: score >= env.SCORE_THRESHOLD };
}