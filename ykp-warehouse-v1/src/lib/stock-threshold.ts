export type StockAlertLevel = 'LOW' | 'OVER' | null;

export interface ThresholdConfig {
  threshold_type?: string;
  warning_value?: string;
  high_value?: string;
  critical_value?: string;
  notify_recipient?: string;
}

/**
 * Decide whether an item's on-hand quantity breaches a configured stock
 * threshold. Keeps the pure decision (unit-agnostic; caller supplies matching
 * units) testable; returns NULL when nothing is breached or the config is inert.
 */
export function stockAlertLevel(onHand: number, config: ThresholdConfig): StockAlertLevel {
  const warning = config.warning_value ? Number(config.warning_value) : NaN;
  const high = config.high_value ? Number(config.high_value) : NaN;
  const critical = config.critical_value ? Number(config.critical_value) : NaN;
  if (!Number.isFinite(onHand)) return null;
  const lowFloor = [warning, critical].filter(Number.isFinite);
  if (lowFloor.length && onHand <= Math.max(...lowFloor)) return 'LOW';
  if (Number.isFinite(high) && onHand >= high) return 'OVER';
  return null;
}

/** Recipient selector to use for a breached threshold; empty means unconfigured (no send). */
export function thresholdRecipient(config: ThresholdConfig): string {
  return (config.notify_recipient ?? '').trim();
}
