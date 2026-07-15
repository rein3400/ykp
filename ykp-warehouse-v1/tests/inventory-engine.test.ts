import { describe, it, expect } from 'vitest';
import {
  reorderPoint, availableStock, daysOfCover,
  suggestedPurchase, priority, computeRecommendation
} from '../src/lib/inventory-engine';

describe('reorderPoint', () => {
  it('computes avg_usage × lead_time + safety', () => {
    expect(reorderPoint({ averageDailyUsage: 11, supplierLeadTimeDays: 2, safetyStock: 5 })).toBe(27);
  });
  it('handles zero usage', () => {
    expect(reorderPoint({ averageDailyUsage: 0, supplierLeadTimeDays: 2, safetyStock: 5 })).toBe(5);
  });
});

describe('availableStock', () => {
  it('book - reserved + transfer + PO', () => {
    expect(availableStock({
      bookStock: 20, reservedQty: 5, confirmedIncomingTransfer: 3, confirmedIncomingPO: 10
    })).toBe(28);
  });
  it('can be negative when reserved > book', () => {
    expect(availableStock({
      bookStock: 5, reservedQty: 10, confirmedIncomingTransfer: 0, confirmedIncomingPO: 0
    })).toBe(-5);
  });
});

describe('daysOfCover', () => {
  it('divides available by usage', () => {
    expect(daysOfCover(18, 11)).toBeCloseTo(1.636, 2);
  });
  it('returns null when usage is 0 (never divide by zero)', () => {
    expect(daysOfCover(100, 0)).toBeNull();
  });
  it('returns null for negative usage', () => {
    expect(daysOfCover(100, -1)).toBeNull();
  });
});

describe('suggestedPurchase', () => {
  it('computes raw and rounds to pack size', () => {
    const r = suggestedPurchase({
      averageDailyUsage: 5, supplierLeadTimeDays: 2, safetyStock: 3,
      maximumStock: 25, bookStock: 10, reservedQty: 0,
      confirmedIncomingTransfer: 0, confirmedIncomingPO: 0,
      packSize: 5, minimumOrderQuantity: 5
    });
    // raw = 25 - 10 = 15, already multiple of 5
    expect(r.raw).toBe(15);
    expect(r.rounded).toBe(15);
  });
  it('rounds up to pack size', () => {
    const r = suggestedPurchase({
      averageDailyUsage: 5, supplierLeadTimeDays: 2, safetyStock: 3,
      maximumStock: 26, bookStock: 10, reservedQty: 0,
      confirmedIncomingTransfer: 0, confirmedIncomingPO: 0,
      packSize: 5, minimumOrderQuantity: 1
    });
    // raw = 16, ceil(16/5)*5 = 20
    expect(r.raw).toBe(16);
    expect(r.rounded).toBe(20);
  });
  it('enforces MOQ', () => {
    const r = suggestedPurchase({
      averageDailyUsage: 1, supplierLeadTimeDays: 1, safetyStock: 0,
      maximumStock: 3, bookStock: 1, reservedQty: 0,
      confirmedIncomingTransfer: 0, confirmedIncomingPO: 0,
      packSize: 1, minimumOrderQuantity: 10
    });
    // raw = 2, but MOQ = 10
    expect(r.raw).toBe(2);
    expect(r.rounded).toBe(10);
  });
  it('floors at 0 when overstocked', () => {
    const r = suggestedPurchase({
      averageDailyUsage: 5, supplierLeadTimeDays: 2, safetyStock: 3,
      maximumStock: 25, bookStock: 30, reservedQty: 0,
      confirmedIncomingTransfer: 0, confirmedIncomingPO: 0,
      packSize: 1, minimumOrderQuantity: 1
    });
    expect(r.raw).toBe(0);
    expect(r.rounded).toBe(0);
  });
});

describe('priority', () => {
  const base = {
    averageDailyUsage: 11, supplierLeadTimeDays: 2, safetyStock: 5,
    maximumStock: 40, reservedQty: 0, confirmedIncomingTransfer: 0,
    confirmedIncomingPO: 0, packSize: 1, minimumOrderQuantity: 1
  };

  it('CRITICAL when available <= 0', () => {
    expect(priority({ ...base, bookStock: 0 })).toBe('CRITICAL');
  });
  it('CRITICAL when days_of_cover < lead_time', () => {
    // available=18, usage=11 → doc=1.6 < lead=2
    expect(priority({ ...base, bookStock: 18 })).toBe('CRITICAL');
  });
  it('HIGH when available <= reorder_point', () => {
    // reorder = 11*2+5 = 27; available=25 → HIGH (doc=2.27 > lead=2 so not CRITICAL)
    expect(priority({ ...base, bookStock: 25 })).toBe('HIGH');
  });
  it('LOW when well stocked', () => {
    expect(priority({ ...base, bookStock: 50 })).toBe('LOW');
  });
});

describe('computeRecommendation', () => {
  it('returns full snapshot', () => {
    const r = computeRecommendation({
      itemId: 'ITM-002', itemName: 'Ayam Fillet',
      averageDailyUsage: 11, supplierLeadTimeDays: 2, safetyStock: 5,
      maximumStock: 40, bookStock: 18, reservedQty: 0,
      confirmedIncomingTransfer: 0, confirmedIncomingPO: 0,
      packSize: 1, minimumOrderQuantity: 10,
      estimatedUnitPrice: 55000, purchaseUnit: 'kg',
      supplierId: 'SUP-001', supplierName: 'Supplier Utama'
    });
    expect(r.priority).toBe('CRITICAL');
    expect(r.daysOfCover).toBeCloseTo(1.636, 2);
    expect(r.reorderPoint).toBe(27);
    expect(r.roundedPurchaseQty).toBeGreaterThan(0);
    expect(r.estimatedPurchaseValue).toBe(r.roundedPurchaseQty * 55000);
  });
});
