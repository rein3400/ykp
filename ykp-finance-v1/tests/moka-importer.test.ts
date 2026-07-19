import { describe, it, expect } from 'vitest';
import { parseIdrAmount, parseMokaCsv } from '../src/lib/moka-importer';

describe('parseIdrAmount', () => {
  it('strips Rp prefix and dots', () => {
    expect(parseIdrAmount('Rp 1.234.567')).toBe(1_234_567);
  });

  it('returns 0 for empty/null', () => {
    expect(parseIdrAmount('')).toBe(0);
    expect(parseIdrAmount(undefined)).toBe(0);
  });

  it('treats negative Moka refund/void as magnitude (ported fix)', () => {
    expect(parseIdrAmount('-15000')).toBe(15_000);
    const v = parseIdrAmount('Rp -1.500,00');
    expect(v).toBeGreaterThan(0);
    expect(parseIdrAmount(`-${v}`)).toBe(v); // round-trip symmetric
  });

  it('returns 0 for non-numeric input', () => {
    expect(parseIdrAmount('abc')).toBe(0);
    expect(parseIdrAmount('-')).toBe(0);
  });
});

describe('parseMokaCsv', () => {
  it('parses headers, dd/mm/yyyy dates, and aggregates per (date, outlet)', () => {
    const csv = [
      'Tanggal,Outlet,Gross Sales,Net Sales,Discount,Refund,Void,Payment Method,Transaction Count',
      '02/07/2026,Funkydak Cipete,Rp 5.000.000,Rp 4.800.000,Rp 100.000,0,Rp 100.000,Cash,80',
      '02/07/2026,Funkydak Cipete,Rp 1.000.000,Rp 1.000.000,0,0,0,QRIS,20'
    ].join('\n');
    const r = parseMokaCsv(csv);
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(1);
    const row = r.rows[0];
    expect(row.date).toBe('2026-07-02');
    expect(row.grossSales).toBe(6_000_000);
    expect(row.netSales).toBe(5_800_000);
    expect(row.discount).toBe(100_000);
    expect(row.transactionCount).toBe(100);
    expect(row.aov).toBe(58_000);
    expect(row.settlement.cash).toBe(4_800_000);
    expect(row.settlement.qris).toBe(1_000_000);
    expect(r.variance_report.total_input_lines).toBe(2);
    expect(r.variance_report.parsed_lines).toBe(1);
  });

  it('keeps negative refund/void magnitudes in the aggregate', () => {
    const csv = [
      'date,outlet,gross_sales,net_sales,discount,refund,void,payment_method,transaction_count',
      '2026-07-02,Funkydak Cipete,5000000,4800000,100000,-150000,-50000,cash,80'
    ].join('\n');
    const r = parseMokaCsv(csv);
    expect(r.rows[0].refund).toBe(150_000);
    expect(r.rows[0].voidAmount).toBe(50_000);
  });

  it('drops rows missing date or outlet and reports variance', () => {
    const csv = [
      'date,outlet,gross_sales,net_sales,payment_method',
      '2026-07-02,,1000,1000,cash',
      ',Funkydak Cipete,1000,1000,cash',
      '2026-07-02,Funkydak Cipete,1000,1000,cash'
    ].join('\n');
    const r = parseMokaCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toHaveLength(2);
    expect(r.variance_report.dropped_lines).toBe(2);
  });

  it('maps payment aliases to settlement buckets and flags unknown methods', () => {
    const csv = [
      'date,outlet,gross_sales,net_sales,payment_method,transaction_count',
      '2026-07-02,A,1000,1000,tunai,1',
      '2026-07-02,B,1000,1000,gofood,1',
      '2026-07-02,C,1000,1000,debit_card,1',
      '2026-07-02,D,1000,1000,crypto,1'
    ].join('\n');
    const r = parseMokaCsv(csv);
    expect(r.rows.find((x) => x.outletName === 'A')?.settlement.cash).toBe(1000);
    expect(r.rows.find((x) => x.outletName === 'B')?.settlement.marketplace).toBe(1000);
    expect(r.rows.find((x) => x.outletName === 'C')?.settlement.card).toBe(1000);
    expect(r.variance_report.alias_guesses['crypto']).toBe('unresolved');
  });

  it('handles quoted cells and BOM', () => {
    const csv = '﻿date,outlet,gross_sales,net_sales,payment_method\n2026-07-02,"Funkydak, Cipete",1000,1000,cash';
    const r = parseMokaCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].outletName).toBe('Funkydak, Cipete');
  });

  it('empty input returns zeroed variance report', () => {
    const r = parseMokaCsv('date,outlet\n');
    expect(r.rows).toHaveLength(0);
    expect(r.variance_report.total_input_lines).toBe(0);
  });
});
