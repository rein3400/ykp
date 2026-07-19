/**
 * Fraud-prevention controls (P0) — YKP anti-fraud blueprint.
 *
 * 1. Segregation of duties: requester can never approve their own record.
 * 2. Variance thresholds per owner SOP (Master_Item tolerance 2–5%,
 *    Dashboard KPI "selisih stok ≤ 2%", "waste ratio ≤ 2%").
 * 3. Receiving 3-way comparison: qty_ordered ↔ qty_delivered ↔ scale_weight.
 *
 * Pure functions — no I/O. Routes call assert*() and map FraudControlError
 * to HTTP 400/403.
 */

export class FraudControlError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'FraudControlError';
    this.code = code;
  }
}

/** Owner SOP thresholds (from "YKP Sistem Kontrol Bahan Baku v1.xlsx"). */
export const VARIANCE_WARN_PCT = 2; // Dashboard KPI: selisih ≤ 2%
export const VARIANCE_CRIT_PCT = 5; // Golden rule: > 5% wajib eskalasi
export const WASTE_RATIO_LIMIT_PCT = 2; // Dashboard KPI: waste ≤ 2%
export const MIN_REASON_LENGTH = 5;

/**
 * Segregation of duties — the person who created/requested a record must
 * not be the one approving it. Breaks every solo fraud chain:
 * create fake adjustment → approve it yourself → ledger posts → stock "fixed".
 */
export function assertNotSelfApproval(requestedBy: string, approverId: string, context = 'record'): void {
  if (!requestedBy) return; // legacy rows without requester — allowed but logged upstream
  if (requestedBy.trim().toLowerCase() === approverId.trim().toLowerCase()) {
    throw new FraudControlError(
      'SELF_APPROVAL',
      `Segregation of duties: ${context} cannot be approved by its requester (${requestedBy}). ` +
      'Mintalah approval dari supervisor/owner.'
    );
  }
}

/** Two-party receiving: verifier must exist and differ from receiver. */
export function assertReceivingVerification(receivedBy: string, verifiedBy: string | undefined): void {
  if (!verifiedBy || !verifiedBy.trim()) {
    throw new FraudControlError(
      'VERIFICATION_REQUIRED',
      'Penerimaan dengan selisih wajib diverifikasi orang kedua (verified_by).'
    );
  }
  if (receivedBy.trim().toLowerCase() === verifiedBy.trim().toLowerCase()) {
    throw new FraudControlError(
      'SELF_VERIFICATION',
      'Verifier harus orang yang berbeda dari receiver (TTD 2 orang).'
    );
  }
}

export function assertReason(reason: string | undefined, field = 'reason'): void {
  if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
    throw new FraudControlError(
      'REASON_REQUIRED',
      `${field} wajib diisi (min ${MIN_REASON_LENGTH} karakter) untuk audit trail.`
    );
  }
}

export type VarianceSeverity = 'OK' | 'HIGH' | 'CRITICAL';

/** Classify |diff|/base as a percentage against owner thresholds. */
export function varianceSeverity(diffPct: number, warnPct = VARIANCE_WARN_PCT, critPct = VARIANCE_CRIT_PCT): VarianceSeverity {
  const abs = Math.abs(diffPct);
  if (abs > critPct) return 'CRITICAL';
  if (abs > warnPct) return 'HIGH';
  return 'OK';
}

/** Percentage difference between two quantities. Returns 0 when base is 0 and diff is 0; 100 when base is 0 and diff > 0. */
export function variancePct(actual: number, expected: number): number {
  if (expected === 0) return actual === 0 ? 0 : 100;
  return ((actual - expected) / expected) * 100;
}

export interface ThreeWayCheck {
  severity: VarianceSeverity;
  pctVsOrdered: number;
  pctVsScale: number | null;
  messages: string[];
}

/**
 * Receiving 3-way comparison: qty_ordered (PO) ↔ qty_accepted ↔ scale_weight.
 * Scale weight, when present, is the physical truth — invoice/PO can be forged,
 * the scale cannot (photo of display is attached as evidence).
 */
export function checkReceivingThreeWay(qtyOrdered: number, qtyAccepted: number, scaleWeight?: number): ThreeWayCheck {
  const pctVsOrdered = variancePct(qtyAccepted, qtyOrdered);
  const pctVsScale = scaleWeight !== undefined && scaleWeight > 0 ? variancePct(scaleWeight, qtyAccepted) : null;
  const messages: string[] = [];
  if (Math.abs(pctVsOrdered) > VARIANCE_WARN_PCT) {
    messages.push(`accepted ${qtyAccepted} vs ordered ${qtyOrdered} (${pctVsOrdered.toFixed(1)}%)`);
  }
  if (pctVsScale !== null && Math.abs(pctVsScale) > VARIANCE_WARN_PCT) {
    messages.push(`scale ${scaleWeight} vs accepted ${qtyAccepted} (${pctVsScale.toFixed(1)}%)`);
  }
  const sev1 = varianceSeverity(pctVsOrdered);
  const sev2 = pctVsScale !== null ? varianceSeverity(pctVsScale) : 'OK';
  const severity: VarianceSeverity =
    sev1 === 'CRITICAL' || sev2 === 'CRITICAL' ? 'CRITICAL'
    : sev1 === 'HIGH' || sev2 === 'HIGH' ? 'HIGH'
    : 'OK';
  return { severity, pctVsOrdered, pctVsScale, messages };
}
