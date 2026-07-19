/**
 * Pure cash reconciliation logic ΓÇö brief ┬º6.7.
 *
 * Formulas (exact from brief):
 *   Expected Cash = Opening Cash + POS Cash Sales ΓêÆ Petty Cash Used ΓêÆ Cash Deposit
 *   Cash Difference = Physical Cash ΓêÆ Expected Cash
 *
 * Denomination counter: physical cash is counted per IDR denomination.
 * Discrepancy status: MATCHED / WITHIN_TOLERANCE / OVER_TOLERANCE / CRITICAL.
 */

/** IDR bill/coin denominations supported by the counter (largest first). */
export const DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100] as const;
export type Denomination = (typeof DENOMINATIONS)[number];

/** Sheet column name for a denomination count, e.g. denom_50000. */
export function denomColumn(d: Denomination): string {
  return `denom_${d}`;
}

/** Physical cash total from per-denomination piece counts. */
export function denomTotal(counts: Partial<Record<Denomination, number>>): number {
  let total = 0;
  for (const d of DENOMINATIONS) total += d * (counts[d] ?? 0);
  return total;
}

export interface CashReconInput {
  openingCash: number;
  posCashSales: number;
  pettyCashUsed: number;
  cashDeposit: number;
}

/** Expected Cash = Opening + POS Cash Sales ΓêÆ Petty Cash Used ΓêÆ Cash Deposit */
export function expectedCash(input: CashReconInput): number {
  return input.openingCash + input.posCashSales - input.pettyCashUsed - input.cashDeposit;
}

/** Cash Difference = Physical ΓêÆ Expected */
export function cashDifference(physicalCash: number, expected: number): number {
  return physicalCash - expected;
}

export type DiscrepancyStatus = 'MATCHED' | 'WITHIN_TOLERANCE' | 'OVER_TOLERANCE' | 'CRITICAL';

/**
 * Discrepancy status against tolerance (default Rp50.000):
 * - diff = 0            ΓåÆ MATCHED
 * - |diff| <= tolerance ΓåÆ WITHIN_TOLERANCE
 * - |diff| <= 4x tol    ΓåÆ OVER_TOLERANCE
 * - beyond              ΓåÆ CRITICAL
 */
export function discrepancyStatus(diff: number, tolerance = 50000): DiscrepancyStatus {
  const abs = Math.abs(diff);
  if (abs === 0) return 'MATCHED';
  if (abs <= tolerance) return 'WITHIN_TOLERANCE';
  if (abs <= tolerance * 4) return 'OVER_TOLERANCE';
  return 'CRITICAL';
}

/** Brief rule: |cash_difference| > Rp50.000 = HIGH alert. */
export function isCashAlert(diff: number, tolerance = 50000): boolean {
  return Math.abs(diff) > tolerance;
}
