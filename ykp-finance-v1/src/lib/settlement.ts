/**
 * POS settlement validation (Revisi #5).
 *
 * Per-payment-method breakdown (Cash/QRIS/Card/Transfer/Marketplace) must
 * reconcile to Net Sales: total_settlement == net_sales, otherwise the
 * difference is recorded (signed: net_sales - total_settlement) and an alert
 * fires when |difference| exceeds tolerance.
 *
 * Pure — no I/O.
 */

export const SETTLEMENT_METHODS = ['cash', 'qris', 'card', 'transfer', 'marketplace'] as const;
export type SettlementMethod = (typeof SETTLEMENT_METHODS)[number];

export interface SettlementParts {
  cash: number;
  qris: number;
  card: number;
  transfer: number;
  marketplace: number;
}

export interface SettlementResult extends SettlementParts {
  totalSettlement: number;
  /** Signed: net_sales - total_settlement. Positive = settlement short. */
  settlementDifference: number;
  /** |difference| > tolerance */
  mismatch: boolean;
}

export function computeSettlement(
  parts: Partial<Record<SettlementMethod, number>>,
  netSales: number,
  tolerance = 0
): SettlementResult {
  const norm = (v: number | undefined) => (Number.isFinite(v) ? Math.max(0, Math.trunc(v as number)) : 0);
  const cash = norm(parts.cash);
  const qris = norm(parts.qris);
  const card = norm(parts.card);
  const transfer = norm(parts.transfer);
  const marketplace = norm(parts.marketplace);
  const totalSettlement = cash + qris + card + transfer + marketplace;
  const settlementDifference = Math.trunc(netSales) - totalSettlement;
  return {
    cash, qris, card, transfer, marketplace,
    totalSettlement,
    settlementDifference,
    mismatch: Math.abs(settlementDifference) > Math.max(0, tolerance)
  };
}

/** Moka tolerance: ≤ 1% of net sales or Rp 10.000, whichever is larger (blueprint §7.6). */
export function mokaTolerance(netSales: number): number {
  return Math.max(10_000, Math.round(Math.abs(netSales) * 0.01));
}

/** Read settlement parts from a fin_pos_daily sheet row. */
export function settlementFromRow(row: Record<string, string>): SettlementResult {
  const net = Number(row.net_sales || 0);
  return computeSettlement({
    cash: Number(row.settle_cash || 0),
    qris: Number(row.settle_qris || 0),
    card: Number(row.settle_card || 0),
    transfer: Number(row.settle_transfer || 0),
    marketplace: Number(row.settle_marketplace || 0)
  }, net, 0);
}
