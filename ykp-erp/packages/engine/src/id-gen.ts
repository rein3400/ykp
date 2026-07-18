// ============================================================
// @ykp/engine — ID generators
// ------------------------------------------------------------
// Stable, prefixed IDs per business entity. Sequential where
// possible (brand, outlet, supplier, employee). Date-encoded
// where uniqueness per-day matters (Hermez alerts/briefs,
// finance cost rows).
// ============================================================

/**
 * Sequence-backed prefix ID generator.
 * Use once at app boot to load the current highest numeric suffix
 * per prefix from the master DB, then call next() to allocate.
 */
export class PrefixIdSequence {
  private current = 0;
  constructor(private prefix: string, startingFrom = 0) {
    this.current = startingFrom;
  }
  /** Returns next ID with zero-padded suffix (default 3 digits). */
  next(width = 3): string {
    this.current += 1;
    return `${this.prefix}${String(this.current).padStart(width, "0")}`;
  }
  peek(): string {
    return `${this.prefix}${String(this.current + 1).padStart(3, "0")}`;
  }
}

/** Brand ID: BR-001. */
export function brandId(seq: PrefixIdSequence): string {
  return seq.next(3);
}
/** Outlet ID: OL-001. */
export function outletId(seq: PrefixIdSequence): string {
  return seq.next(3);
}
/** Employee ID: EMP-00001. */
export function employeeId(seq: PrefixIdSequence): string {
  return seq.next(5);
}
/** Supplier ID: SUP-0001. */
export function supplierId(seq: PrefixIdSequence): string {
  return seq.next(4);
}
/** HR rule ID: HRR-OUT-001. */
export function hrRuleId(outletCode: string, seq: PrefixIdSequence): string {
  return `HRR-${outletCode}-${seq.next(3)}`;
}

/**
 * Generic finance row ID: FIN-YYYYMMDD-NNN (per day).
 * Defect H7: callers that need outlet uniqueness must pass outletId
 * to avoid ID collisions. Plain date+seq stays supported for rows that
 * are globally unique by date.
 */
export function financeDayId(dateStr: string, seq: number, outletId?: string): string {
  const d = dateStr.replace(/-/g, "");
  const suffix = outletId ? `-${outletId}` : "";
  return `FIN-${d}${suffix}-${String(seq).padStart(3, "0")}`;
}

/**
 * HR daily summary ID: HRR-OUT-YYYYMMDD-NNN (per date+outlet).
 * Defect H7: always encode outletId so daily summaries for different
 * outlets on the same date never collide.
 */
export function hrDailySummaryId(dateStr: string, outletId: string, seq: number): string {
  const d = dateStr.replace(/-/g, "");
  return `HRR-${outletId}-${d}-${String(seq).padStart(3, "0")}`;
}

/** Hermez brief ID: HZBR-YYYYMMDD (one per date). */
export function hermezBriefId(dateStr: string): string {
  return `HZBR-${dateStr.replace(/-/g, "")}`;
}

/** Hermez alert ID: HZAL-YYYYMMDD-NNN (per day, sequential). */
export function hermezAlertId(dateStr: string, seq: number): string {
  const d = dateStr.replace(/-/g, "");
  return `HZAL-${d}-${String(seq).padStart(3, "0")}`;
}

/**
 * Generate a stable receipt ID.
 * Format: RCP-YYYYMMDD-OL-NNNN
 */
export function receiptId(date: string, outletId: string, seq: number): string {
  const d = date.replace(/-/g, "");
  const seqStr = seq.toString().padStart(4, "0");
  return `RCP-${d}-${outletId}-${seqStr}`;
}

/** UUID v4 fallback for surrogate keys (e.g. when sequence not available). */
export function uuid(): string {
  // Prefer the cryptographically secure webcrypto uuid; fall back to
  // nanoid-style entropy if the global is unavailable (older runtimes).
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === "function") {
    return g.crypto.randomUUID();
  }
  // RFC 4122 v4 using crypto.getRandomValues when available.
  const rng = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (typeof rng.crypto?.getRandomValues === "function") {
    const b = new Uint8Array(16);
    rng.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }
  throw new Error("uuid(): no cryptographic random source available (require crypto.randomUUID)");
}