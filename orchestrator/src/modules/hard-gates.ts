/**
 * ICT hard entry gates (ICT_TRADING_STRATEGY.md §3).
 * Fail-closed: any false → no trade. Score is evaluated only after all gates pass.
 */
export interface HardGateInput {
  sweep: string;
  mss: string;
  ifvg: string;
  bias: string;
  sessionOk: boolean;
  newsOk: boolean;
  /** Realized RR for the planned entry/SL/TP. Must be ≥ minRr. */
  rr: number;
  minRr?: number;
}

export interface HardGateResult {
  ok: boolean;
  failed: string[];
  reasons: Record<string, string>;
}

const DEFAULT_MIN_RR = 3;

/**
 * Evaluate the five hard gates + RR floor.
 * Alignment (bias === mss === ifvg) is required once structure flags are present.
 */
export function evaluateHardGates(input: HardGateInput): HardGateResult {
  const minRr = input.minRr ?? DEFAULT_MIN_RR;
  const failed: string[] = [];
  const reasons: Record<string, string> = {};

  if (!input.sweep) {
    failed.push('NO_SWEEP');
    reasons.NO_SWEEP = 'No Sweep = No trade';
  }
  if (!input.mss) {
    failed.push('NO_MSS');
    reasons.NO_MSS = 'No MSS = No trade';
  }
  if (!input.ifvg) {
    failed.push('NO_IFVG');
    reasons.NO_IFVG = 'No IFVG = No entry';
  }
  if (!input.sessionOk) {
    failed.push('SESSION');
    reasons.SESSION = 'Outside Kill Zone / Silver Bullet window';
  }
  if (!input.newsOk) {
    failed.push('NEWS');
    reasons.NEWS = 'High-impact news window not clear';
  }
  if (!(input.rr >= minRr)) {
    failed.push('RR');
    reasons.RR = `RR ${input.rr} < min ${minRr} (need ≥ 1:${minRr})`;
  }

  // Directional alignment once structure is present
  if (input.bias && input.mss && input.ifvg) {
    if (!(input.bias === input.mss && input.mss === input.ifvg)) {
      failed.push('ALIGNMENT');
      reasons.ALIGNMENT = `bias/mss/ifvg misaligned (${input.bias}/${input.mss}/${input.ifvg})`;
    }
  }

  // Sweep side vs bias: SSL (sell-side liquidity) typically precedes bullish reversal
  if (input.bias && input.sweep) {
    const bullishSweep = input.sweep === 'ssl';
    const bearishSweep = input.sweep === 'bsl';
    if (input.bias === 'bull' && !bullishSweep) {
      failed.push('SWEEP_SIDE');
      reasons.SWEEP_SIDE = 'Bullish bias expects SSL sweep (sell-side raid)';
    }
    if (input.bias === 'bear' && !bearishSweep) {
      failed.push('SWEEP_SIDE');
      reasons.SWEEP_SIDE = 'Bearish bias expects BSL sweep (buy-side raid)';
    }
  }

  return { ok: failed.length === 0, failed, reasons };
}
