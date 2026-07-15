import { describe, it, expect, vi } from 'vitest';
import { scoreSetup } from '../src/modules/scoring.js';
import { SCORING_WEIGHTS } from '../src/config/constants.js';

vi.mock('../src/config/env.js', () => ({ env: { SCORE_THRESHOLD: 80 } }));

const fullBull = {
  bias: 'bull' as const,
  dolSide: 'buy',
  sweep: 'ssl',
  mss: 'bull',
  ifvg: 'bull',
  smt: 'bull',
  silverBullet: true,
  sessionOk: true,
  newsOk: true,
  rr: 3
};

describe('scoreSetup (ICT_TRADING_STRATEGY §4)', () => {
  it('weights sum to 100', () => {
    const sum = Object.values(SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('passes a fully aligned setup with score=100', () => {
    const r = scoreSetup(fullBull);
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
    expect(r.fullRiskEligible).toBe(true);
    expect(r.breakdown).toEqual({
      htfAlign: 25,
      sweep: 15,
      mss: 15,
      ifvg: 15,
      rr: 15,
      session: 10,
      newsClear: 5
    });
  });

  it('scores 0 RR component when RR < 3', () => {
    const r = scoreSetup({ ...fullBull, rr: 2 });
    expect(r.breakdown.rr).toBe(0);
    expect(r.score).toBe(85);
    expect(r.passed).toBe(true);
  });

  it('fails HTF align when DOL disagrees with bias', () => {
    const r = scoreSetup({ ...fullBull, dolSide: 'sell' });
    expect(r.breakdown.htfAlign).toBe(0);
    // sweep15 + mss15 + ifvg15 + rr15 + session10 + news5 = 75 (no HTF 25)
    expect(r.score).toBe(75);
    expect(r.passed).toBe(false);
  });

  it('fails when session invalid (10pt off)', () => {
    const r = scoreSetup({ ...fullBull, sessionOk: false });
    expect(r.score).toBe(90);
    expect(r.passed).toBe(true);
    expect(r.fullRiskEligible).toBe(true);
  });

  it('fails hard below threshold without structure', () => {
    const r = scoreSetup({
      bias: '',
      dolSide: '',
      sweep: '',
      mss: '',
      ifvg: '',
      smt: '',
      silverBullet: false,
      sessionOk: true,
      newsOk: true,
      rr: 3
    });
    // session 10 + news 5 + rr 15 = 30
    expect(r.score).toBe(30);
    expect(r.passed).toBe(false);
  });

  it('gives half sweep credit when quality.cleanSweep=false', () => {
    const r = scoreSetup({ ...fullBull, quality: { cleanSweep: false } });
    expect(r.breakdown.sweep).toBe(7);
    expect(r.score).toBe(92);
  });
});
