import { describe, it, expect } from 'vitest';
import { normalizeMokaSales } from '@/lib/moka-auth';

type Raw = Record<string, unknown>;

function invoice(over: Partial<Raw> = {}): Raw {
  return {
    transaction_time: '2026-08-30T15:00:00+07:00',
    outlet_name: 'Funkydak Cipete',
    sub_total: 1_000_000,
    discount_amount: 100_000,
    refunds_amount: 0,
    void_amount: 0,
    tax_amount: 0,
    service_amount: 0,
    payments: [{ type: 'CASH', amount: 700_000 }, { type: 'QRIS', amount: 200_000 }],
    ...over,
  };
}

describe('normalizeMokaSales', () => {
  it('aggregates invoices per (date, outlet): sums money and counts', () => {
    const rows = normalizeMokaSales([
      invoice(),
      invoice({ sub_total: 600_000, discount_amount: 0, payments: [{ type: 'CASH', amount: 600_000 }] }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2026-08-30');
    expect(rows[0].outletName).toBe('Funkydak Cipete');
    expect(rows[0].grossSales).toBe(1_600_000);
    expect(rows[0].discount).toBe(100_000);
    expect(rows[0].netSales).toBe(1_500_000);
    expect(rows[0].transactionCount).toBe(2);
    expect(rows[0].settlement.cash).toBe(1_300_000);
    expect(rows[0].settlement.qris).toBe(200_000);
    expect(rows[0].settlement.card).toBe(0);
    expect(rows[0].settlement.transfer).toBe(0);
    expect(rows[0].settlement.marketplace).toBe(0);
  });

  it('buckets payment types case-insensitively across aliases', () => {
    const rows = normalizeMokaSales([invoice({
      payments: [
        { type: 'cash', amount: 1 },
        { type: 'GoPay', amount: 2 },
        { type: 'DEBIT', amount: 3 },
        { type: 'GoFood', amount: 4 },
        { type: 'BANK_TRANSFER', amount: 5 },
      ],
    })]);
    expect(rows[0].settlement.cash).toBe(1);
    expect(rows[0].settlement.qris).toBe(2);
    expect(rows[0].settlement.card).toBe(3);
    expect(rows[0].settlement.marketplace).toBe(4);
    expect(rows[0].settlement.transfer).toBe(5);
  });

  it('drops invoices missing date or outlet', () => {
    const rows = normalizeMokaSales([
      invoice({ transaction_time: '' }),
      invoice({ outlet_name: '' }),
      invoice(),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].transactionCount).toBe(1);
  });

  it('uses fallbackBrand when invoice has no brand_name', () => {
    const rows = normalizeMokaSales([invoice()], 'Funkydak');
    expect(rows[0].brandName).toBe('Funkydak');
  });

  it('accepts raw wrapper shapes { invoices: [...] } or { data: [...] } and returns [] for null', () => {
    expect(normalizeMokaSales({ invoices: [invoice()] })).toHaveLength(1);
    expect(normalizeMokaSales({ data: [invoice()] })).toHaveLength(1);
    expect(normalizeMokaSales(null)).toEqual([]);
  });
});