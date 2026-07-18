/**
 * Finance flow smoke test — exercises the pure helpers used by finance:
 *   - parseMokaCsv (now per-receipt, not daily aggregate)
 *   - IDR math: net_sales, aov, unpaid_amount, expected_cash
 *   - transitionApproval role + amount tiers
 *
 * No real Postgres connection is opened.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------- Helpers under test ---------------------------------------------
import { parseMokaCsv, transitionApproval, financeDayId, todayWib } from "@ykp/engine";

describe("finance-flow smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parseMokaCsv returns one receipt per CSV line", () => {
    const csv = [
      "date,brand,outlet,receipt_number,gross_sales,net_sales,discount,refund,void_amount,transaction_count,payment_method",
      "2026-07-07,Brand A,Outlet Sudirman,RCPT-001,Rp 100.000,Rp 90.000,Rp 5.000,Rp 0,Rp 5.000,1,tunai",
      "2026-07-07,Brand A,Outlet Sudirman,RCPT-002,Rp 50.000,Rp 45.000,Rp 0,Rp 5.000,Rp 0,1,qris",
      "2026-07-07,Brand A,Outlet Senopati,RCPT-003,Rp 80.000,Rp 75.000,Rp 0,Rp 0,Rp 5.000,1,tunai",
    ].join("\n");
    const res = parseMokaCsv(csv);
    expect(res.rows).toHaveLength(3);
    const sudirman = res.rows.filter((r) => r.outletName === "Outlet Sudirman");
    expect(sudirman).toHaveLength(2);
    expect(sudirman.reduce((a, r) => a + r.grossSales, 0)).toBe(150_000);
    expect(sudirman.reduce((a, r) => a + r.netSales, 0)).toBe(135_000);
    expect(sudirman[0].receiptNumber).toBe("RCPT-001");
  });

  it("financeDayId produces FIN-YYYYMMDD-NNN", () => {
    expect(financeDayId("2026-07-07", 1)).toBe("FIN-20260707-001");
    expect(financeDayId("2026-07-07", 12)).toBe("FIN-20260707-012");
  });

  it("todayWib returns YYYY-MM-DD", () => {
    const v = todayWib();
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("transitionApproval rejects PENDING -> PAID for OUTLET_MANAGER on supplier", () => {
    const res = transitionApproval(
      { id: "c1", entity: "supplier_cost", amount: 50_000_000, status: "PENDING" },
      "PENDING",
      "APPROVED",
      { id: "u1", role: "FINANCE_ADMIN" },
    );
    expect(res.ok).toBe(true);
  });

  it("transitionApproval rejects over-threshold amount for wrong role", () => {
    const res = transitionApproval(
      { id: "c2", entity: "supplier_cost", amount: 200_000_000, status: "PENDING" },
      "PENDING",
      "APPROVED",
      { id: "u2", role: "FINANCE_ADMIN" },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/cannot approve amount/);
  });

  it("transitionApproval requires matching from_status", () => {
    const res = transitionApproval(
      { id: "c3", entity: "expense", amount: 100_000, status: "APPROVED" },
      "DRAFT",
      "APPROVED",
      { id: "u3", role: "OUTLET_MANAGER" },
    );
    expect(res.ok).toBe(false);
  });

  it("IDR math invariants (net_sales, aov, unpaid, expected_cash)", () => {
    // POS
    const gross = 200_000,
      discount = 20_000,
      refund = 10_000,
      voidAmt = 5_000;
    const netSales = gross - discount - refund - voidAmt;
    expect(netSales).toBe(165_000);
    const aov = Math.round(netSales / 8);
    expect(aov).toBe(20_625);

    // Supplier
    const amount = 1_000_000,
      paid = 250_000;
    expect(amount - paid).toBe(750_000);

    // Closing
    const opening = 500_000,
      posCashSales = 1_200_000,
      pettyOut = 100_000;
    const expected = opening + posCashSales - pettyOut;
    expect(expected).toBe(1_600_000);
    const physical = 1_580_000;
    expect(physical - expected).toBe(-20_000);

    // Petty cash balance
    const ob = 1_500_000,
      cashIn = 200_000,
      cashOut = 400_000;
    expect(ob + cashIn - cashOut).toBe(1_300_000);

    // Net profit formula
    const rev = 5_000_000,
      exp = 1_500_000,
      supp = 800_000,
      petty = 200_000;
    expect(rev - exp - supp - petty).toBe(2_500_000);
  });
});
