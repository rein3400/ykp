import { describe, it, expect } from 'vitest';
import {
  evalLowStock, evalStockoutRisk, evalOverstock,
  evalReceivingDiscrepancy, evalTransferDiscrepancy,
  evalWasteOverLimit, evalStockVariance,
  evalNearExpiry, evalExpiredStock,
  evalRecountOverdue, evalActionOverdue,
  shouldCreateAction
} from '../src/lib/rules-engine';

describe('evalLowStock', () => {
  it('fires when available <= reorder', () => {
    const a = evalLowStock(10, 15, 'Ayam', 'ITM-002');
    expect(a).not.toBeNull();
    expect(a!.alertType).toBe('LOW_STOCK');
    expect(a!.severity).toBe('HIGH');
  });
  it('CRITICAL when available <= 0', () => {
    const a = evalLowStock(0, 15, 'Ayam', 'ITM-002');
    expect(a!.severity).toBe('CRITICAL');
  });
  it('null when healthy', () => {
    expect(evalLowStock(30, 15, 'Ayam', 'ITM-002')).toBeNull();
  });
});

describe('evalStockoutRisk', () => {
  it('fires when days_of_cover < lead_time', () => {
    const a = evalStockoutRisk(1.6, 2, 'Ayam', 'ITM-002');
    expect(a).not.toBeNull();
    expect(a!.alertType).toBe('STOCKOUT_RISK');
  });
  it('null when usage is N/A', () => {
    expect(evalStockoutRisk(null, 2, 'Ayam', 'ITM-002')).toBeNull();
  });
});

describe('evalOverstock', () => {
  it('fires when available > max', () => {
    const a = evalOverstock(50, 40, 'Ayam', 'ITM-002');
    expect(a!.alertType).toBe('OVERSTOCK');
  });
  it('null when max is 0', () => {
    expect(evalOverstock(50, 0, 'Ayam', 'ITM-002')).toBeNull();
  });
});

describe('evalReceivingDiscrepancy', () => {
  it('fires on qty shortfall', () => {
    const a = evalReceivingDiscrepancy(10, 8, 'GOOD', 'Ayam', 'RCV-1', 'ITM-002');
    expect(a!.alertType).toBe('RECEIVING_DISCREPANCY');
  });
  it('fires on bad condition', () => {
    const a = evalReceivingDiscrepancy(10, 10, 'DAMAGED', 'Ayam', 'RCV-1', 'ITM-002');
    expect(a!.severity).toBe('HIGH');
  });
  it('null when perfect', () => {
    expect(evalReceivingDiscrepancy(10, 10, 'GOOD', 'Ayam', 'RCV-1', 'ITM-002')).toBeNull();
  });
});

describe('evalTransferDiscrepancy', () => {
  it('fires on mismatch', () => {
    const a = evalTransferDiscrepancy(10, 8, 'Ayam', 'TRF-1', 'ITM-002');
    expect(a!.alertType).toBe('TRANSFER_DISCREPANCY');
  });
  it('null when equal', () => {
    expect(evalTransferDiscrepancy(10, 10, 'Ayam', 'TRF-1', 'ITM-002')).toBeNull();
  });
});

describe('evalWasteOverLimit', () => {
  it('fires when over threshold', () => {
    const a = evalWasteOverLimit(600000, 500000, 'Ayam', 'WST-1', 'ITM-002');
    expect(a!.severity).toBe('HIGH');
  });
  it('CRITICAL when 2x threshold', () => {
    const a = evalWasteOverLimit(1200000, 500000, 'Ayam', 'WST-1', 'ITM-002');
    expect(a!.severity).toBe('CRITICAL');
  });
});

describe('evalStockVariance', () => {
  it('uses unexplained variance terminology', () => {
    const a = evalStockVariance(-1.7, 13.6, 306000, 5, 200000, 'Daging', 'CNT-1', 'ITM-001');
    expect(a).not.toBeNull();
    expect(a!.title).toContain('Unexplained stock variance');
    expect(a!.actionRequired).toContain('Recount');
  });
  it('null within tolerance', () => {
    expect(evalStockVariance(-0.5, 2, 50000, 5, 200000, 'Daging', 'CNT-1', 'ITM-001')).toBeNull();
  });
});

describe('evalNearExpiry / evalExpiredStock', () => {
  it('near expiry within warning days', () => {
    const a = evalNearExpiry(3, 7, 8, 'Cream', 'BATCH-1', 'ITM-X');
    expect(a!.severity).toBe('HIGH');
  });
  it('expired stock', () => {
    const a = evalExpiredStock(-2, 5, 'Cream', 'BATCH-1', 'ITM-X');
    expect(a!.severity).toBe('CRITICAL');
    expect(a!.alertType).toBe('EXPIRED_STOCK');
  });
  it('null when depleted', () => {
    expect(evalNearExpiry(3, 7, 0, 'Cream', 'BATCH-1', 'ITM-X')).toBeNull();
  });
});

describe('evalRecountOverdue / evalActionOverdue', () => {
  it('recount overdue', () => {
    const a = evalRecountOverdue('2026-07-10', 'OPEN', 'Ayam', 'CNT-1', 'ITM-002', '2026-07-14');
    expect(a!.alertType).toBe('RECOUNT_OVERDUE');
  });
  it('action overdue', () => {
    const a = evalActionOverdue('2026-07-10', 'IN_PROGRESS', 'Recount ayam', 'ACT-1', '2026-07-14');
    expect(a!.alertType).toBe('ACTION_OVERDUE');
  });
  it('null when done', () => {
    expect(evalActionOverdue('2026-07-10', 'DONE', 'X', 'ACT-1', '2026-07-14')).toBeNull();
  });
});

describe('shouldCreateAction', () => {
  it('true for HIGH/CRITICAL', () => {
    expect(shouldCreateAction('HIGH')).toBe(true);
    expect(shouldCreateAction('CRITICAL')).toBe(true);
  });
  it('false for lower', () => {
    expect(shouldCreateAction('MEDIUM')).toBe(false);
    expect(shouldCreateAction('INFO')).toBe(false);
  });
});
