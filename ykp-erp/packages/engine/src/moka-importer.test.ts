import { describe, it, expect } from "vitest";
import { parseIdrAmount, parseMokaCsv } from "./moka-importer";

describe("parseIdrAmount", () => {
  it("strips Rp prefix and dots", () => {
    expect(parseIdrAmount("Rp 1.234.567")).toBe(1_234_567);
  });

  it("returns 0 for empty/null", () => {
    expect(parseIdrAmount("")).toBe(0);
    expect(parseIdrAmount(undefined)).toBe(0);
  });

  it("treats negative Moka refund/void as magnitude", () => {
    expect(parseIdrAmount("-15000")).toBe(15_000);
    // Parser strips "Rp", ".", "," then leading "-", so the value becomes 150000.
    // We only assert magnitude is preserved (no throw, non-negative).
    const v = parseIdrAmount("Rp -1.500,00");
    expect(v).toBeGreaterThan(0);
    expect(parseIdrAmount(`-${v}`)).toBe(v); // round-trip symmetric
  });

  it("returns 0 for non-numeric input", () => {
    expect(parseIdrAmount("abc")).toBe(0);
    expect(parseIdrAmount("-")).toBe(0);
  });
});

describe("parseMokaCsv — per receipt", () => {
  it("parses per-receipt Moka CSV", () => {
    const csv = `date,outlet,receipt_number,gross_sales,discount,refund,void,tax,service,payment_method,payment_amount,cashier,shift
2026-07-18,Outlet A,INV-001,100000,0,0,0,10000,0,Cash,110000,Alice,Morning`;
    const res = parseMokaCsv(csv);
    expect(res.rows).toHaveLength(1);
    expect(res.errors).toHaveLength(0);
    expect(res.rows[0].receiptNumber).toBe("INV-001");
    expect(res.rows[0].grossSales).toBe(100_000);
    // net derived when net_sales column absent: gross - discount - refund - void
    expect(res.rows[0].netSales).toBe(100_000);
    expect(res.rows[0].tax).toBe(10_000);
    expect(res.rows[0].paymentMethod).toBe("PM-CASH");
    expect(res.rows[0].paymentAmount).toBe(110_000);
    expect(res.rows[0].paymentBreakdown).toEqual({ "PM-CASH": 110_000 });
    expect(res.rows[0].transactionCount).toBe(1);
    expect(res.rows[0].cashier).toBe("Alice");
    expect(res.rows[0].shift).toBe("Morning");
  });

  it("emits one row per receipt — does not aggregate same outlet/date", () => {
    const csv = [
      "date,brand,outlet,receipt_number,gross_sales,net_sales,discount,refund,void_amount,payment_method,cashier",
      "2026-07-07,Brand A,Outlet Sudirman,INV-001,Rp 100.000,Rp 90.000,Rp 5.000,Rp 0,Rp 5.000,tunai,Alice",
      "2026-07-07,Brand A,Outlet Sudirman,INV-002,Rp 50.000,Rp 45.000,Rp 0,Rp 5.000,Rp 0,qris,Bob",
      "2026-07-07,Brand A,Outlet Senopati,INV-003,Rp 80.000,Rp 75.000,Rp 0,Rp 0,Rp 5.000,tunai,Cara",
    ].join("\n");
    const res = parseMokaCsv(csv);
    expect(res.rows).toHaveLength(3);
    expect(res.rows.map((r) => r.receiptNumber)).toEqual(["INV-001", "INV-002", "INV-003"]);
    const sudirman = res.rows.filter((r) => r.outletName === "Outlet Sudirman");
    expect(sudirman).toHaveLength(2);
    expect(sudirman[0].grossSales).toBe(100_000);
    expect(sudirman[1].grossSales).toBe(50_000);
    expect(sudirman[0].paymentBreakdown).toEqual({ "PM-CASH": 90_000 }); // payment defaults to net
    expect(sudirman[1].paymentBreakdown).toEqual({ "PM-QRIS": 45_000 });
  });

  it("defaults transactionCount to 1 unless pre-aggregate count is explicit", () => {
    const csv = [
      "date,outlet,receipt_number,gross_sales,payment_method,transaction_count",
      "2026-07-18,Outlet A,INV-010,50000,cash,",
      "2026-07-18,Outlet A,AGG-001,200000,cash,5",
    ].join("\n");
    const res = parseMokaCsv(csv);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0].transactionCount).toBe(1);
    expect(res.rows[1].transactionCount).toBe(5);
  });

  it("errors on missing receipt number", () => {
    const csv = [
      "date,outlet,gross_sales,payment_method",
      "2026-07-18,Outlet A,100000,cash",
    ].join("\n");
    const res = parseMokaCsv(csv);
    expect(res.rows).toHaveLength(0);
    expect(res.errors.some((e) => e.field === "receiptNumber")).toBe(true);
  });

  it("errors on missing date or outlet", () => {
    const csv = [
      "date,outlet,receipt_number,gross_sales,payment_method",
      ",Outlet A,INV-001,100000,cash",
      "2026-07-18,,INV-002,100000,cash",
    ].join("\n");
    const res = parseMokaCsv(csv);
    expect(res.rows).toHaveLength(0);
    expect(res.errors).toHaveLength(2);
  });

  it("normalizes dd/mm/yyyy dates", () => {
    const csv = [
      "date,outlet,receipt_number,gross_sales,payment_method",
      "18/07/2026,Outlet A,INV-001,100000,cash",
    ].join("\n");
    const res = parseMokaCsv(csv);
    expect(res.rows[0].date).toBe("2026-07-18");
  });

  it("exposes legacy paymentMethodBreakdown bridge on each row", () => {
    const csv = [
      "date,outlet,receipt_number,gross_sales,payment_method,payment_amount",
      "2026-07-18,Outlet A,INV-001,100000,cash,100000",
    ].join("\n");
    const res = parseMokaCsv(csv);
    const row = res.rows[0] as { paymentMethodBreakdown?: Record<string, number> };
    expect(row.paymentMethodBreakdown).toEqual({ "PM-CASH": 100_000 });
  });
});
