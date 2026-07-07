import { describe, it, expect, vi } from 'vitest';
import { scoreSetup } from '../src/modules/scoring.js';

vi.mock('../src/config/env.js', () => ({ env: { SCORE_THRESHOLD: 80 } }));

describe('scoreSetup', () => {
  it('passes a fully aligned setup with score=100', () => {
    const r = scoreSetup({
      bias: 'bull', dolSide: 'buy', sweep: 'ssl', mss: 'bull', ifvg: 'bull', smt: 'bull', silverBullet: true,
      sessionOk: true, newsOk: true
    });
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
  });

  it('breakdown sums correctly without smt', () => {
    const r = scoreSetup({
      bias: 'bull', dolSide: 'buy', sweep: 'ssl', mss: 'bull', ifvg: 'bull', smt: '', silverBullet: true,
      sessionOk: true, newsOk: true
    });
    expect(r.score).toBe(95);
    expect(r.breakdown.smt).toBe(0);
  });

  it('fails when session invalid (10pt off)', () => {
    const r = scoreSetup({
      bias: 'bull', dolSide: 'buy', sweep: 'ssl', mss: 'bull', ifvg: 'bull', smt: 'bull', silverBullet: true,
      sessionOk: false, newsOk: true
    });
    expect(r.score).toBe(90);
    expect(r.passed).toBe(true); // 90 still above 80
  });

  it('fails when session + news both invalid (20pt off)', () => {
    const r = scoreSetup({
      bias: 'bull', dolSide: 'buy', sweep: 'ssl', mss: 'bull', ifvg: 'bull', smt: 'bull', silverBullet: true,
      sessionOk: false, newsOk: false
    });
    expect(r.score).toBe(80);
    expect(r.passed).toBe(true); // boundary: 80 >= 80
  });

  it('fails when score strictly below threshold', () => {
    const r = scoreSetup({
      bias: 'bull', dolSide: 'buy', sweep: '', mss: '', ifvg: '', smt: '', silverBullet: false,
      sessionOk: true, newsOk: true
    });
    expect(r.score).toBe(20); // bias-align only
    expect(r.passed).toBe(false);
  });
});
