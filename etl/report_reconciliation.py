"""A5: Fraud-signal reconciliation report.

Combines the three extracts to surface the signals from the anti-fraud
blueprint — no BOM required:

1. Supplier price-creep     : same item_key + supplier, unit_price trend
                              (slow inflation = kickback/collusion signal).
2. Petty-cash top-up growth : monthly top-up totals (Rp 2jt -> 7jt trend).
3. Petty-cash spend profile : top expense items, round-amount bias.
4. Stock opname drift       : per-item month-over-month counted deltas.
5. Food-cost inputs         : monthly purchases value + SO snapshot value
                              (ready to join with Moka sales when API lands).
6. P2 analytics             : Benford MAD, purchase round bias, supplier
                              concentration (peer stats) — analytics_p2.

Output: output/reconciliation_report.md + machine-readable CSVs.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

import analytics_p2
from common import OUTPUT_DIR, write_csv
from extract_costing import extract as extract_costing
from extract_petty_cash import extract_expenses, extract_topups
from extract_stock_opname import extract as extract_so

PRICE_CREEP_MIN_PCT = 10.0   # flag items up >10% first->last purchase
TOP_PRICE_JUMPS = 15
PETTY_ROUND_MOD = 100_000    # round-amount bias: debits divisible by 100k


def month_of(d: str) -> str:
    return d[:7] if d else ""


def price_creep(purchases: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for (item, sup), g in purchases.groupby(["item_key", "supplier_key"]):
        g = g[g["unit_price"] > 0].sort_values("order_date")
        if len(g) < 2:
            continue
        first, last = g.iloc[0], g.iloc[-1]
        if first["unit_price"] <= 0:
            continue
        pct = (last["unit_price"] - first["unit_price"]) / first["unit_price"] * 100
        rows.append(
            {
                "item_key": item,
                "supplier_key": sup,
                "purchases": len(g),
                "first_date": first["order_date"],
                "first_price": first["unit_price"],
                "last_date": last["order_date"],
                "last_price": last["unit_price"],
                "change_pct": round(pct, 1),
            }
        )
    out = pd.DataFrame(rows)
    if out.empty:
        return out
    return out[out["change_pct"].abs() >= PRICE_CREEP_MIN_PCT].sort_values("change_pct", ascending=False)


def monthly_purchases(purchases: pd.DataFrame) -> pd.DataFrame:
    p = purchases.copy()
    p["month"] = p["order_date"].apply(month_of)
    return p.groupby("month", as_index=False).agg(purchases_value=("total_amount", "sum"), lines=("purchase_id", "count"))


def petty_monthly(topups: pd.DataFrame, expenses: pd.DataFrame) -> pd.DataFrame:
    # Authoritative top-ups: the 'Additional Petty Cash' lines inside the
    # expense detail sheets. The monthly summary sheets UNDER-RECORD top-ups
    # by up to Rp 37.7jt (April 2026) — tracked separately below.
    t = expenses[expenses["is_topup"]].copy()
    t["month"] = t["date"].apply(month_of)
    tm = t.groupby("month", as_index=False).agg(topup_total=("kredit", "sum"), topups=("expense_id", "count"))
    e = expenses[~expenses["is_topup"]].copy()
    e["month"] = e["date"].apply(month_of)
    em = e.groupby("month", as_index=False).agg(expense_total=("debit", "sum"), lines=("expense_id", "count"))
    out = tm.merge(em, on="month", how="outer").fillna(0).sort_values("month")
    out["net"] = out["topup_total"] - out["expense_total"]
    return out


def summary_vs_detail_gap(topups: pd.DataFrame, expenses: pd.DataFrame) -> pd.DataFrame:
    """Monthly summary sheet top-ups vs expense-sheet top-ups (data-integrity check)."""
    s = topups.copy()
    s["month"] = s["date"].apply(month_of)
    sm = s.groupby("month", as_index=False).agg(summary_total=("amount", "sum"), summary_count=("topup_id", "count"))
    d = expenses[expenses["is_topup"]].copy()
    d["month"] = d["date"].apply(month_of)
    dm = d.groupby("month", as_index=False).agg(detail_total=("kredit", "sum"), detail_count=("expense_id", "count"))
    out = sm.merge(dm, on="month", how="outer").fillna(0).sort_values("month")
    out["gap"] = out["detail_total"] - out["summary_total"]
    return out


def round_amount_bias(expenses: pd.DataFrame) -> pd.DataFrame:
    e = expenses[(~expenses["is_topup"]) & (expenses["debit"] > 0)].copy()
    e["is_round"] = (e["debit"] % PETTY_ROUND_MOD == 0) | (e["debit"] % 50_000 == 0)
    g = e.groupby("month", as_index=False).agg(
        lines=("expense_id", "count"), round_lines=("is_round", "sum"), spend=("debit", "sum")
    )
    g["round_pct"] = (g["round_lines"] / g["lines"] * 100).round(1)
    return g


def so_drift(so: pd.DataFrame) -> pd.DataFrame:
    """Month-over-month counted qty delta per item (last two snapshots)."""
    dates = sorted(so["count_date"].unique())
    if len(dates) < 2:
        return pd.DataFrame()
    prev_d, last_d = dates[-2], dates[-1]
    # Dedupe same item counted twice in one sheet: keep the last entry
    # (later entry is the correction in the owner's workflow).
    so_dd = so.drop_duplicates(subset=["count_date", "item_key"], keep="last")
    prev = so_dd[so_dd["count_date"] == prev_d].set_index("item_key")["qty_counted"]
    last = so_dd[so_dd["count_date"] == last_d].set_index("item_key")["qty_counted"]
    out = pd.DataFrame({"prev": prev, "last": last}).fillna(0).reset_index()
    out["delta"] = out["last"] - out["prev"]
    out["prev_date"] = prev_d
    out["last_date"] = last_d
    return out.reindex(out["delta"].abs().sort_values(ascending=False).index)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print("extracting...")
    purchases = extract_costing()
    xl_pc = pd.ExcelFile(r"C:\Users\user\Downloads\ykp excel report\Petty Cash Expense Funkydak 2026.xlsx")
    topups = extract_topups(xl_pc)
    expenses = extract_expenses(xl_pc)
    so = extract_so()

    print("analyzing...")
    creep = price_creep(purchases)
    pm = monthly_purchases(purchases)
    pcm = petty_monthly(topups, expenses)
    gap = summary_vs_detail_gap(topups, expenses)
    rab = round_amount_bias(expenses)
    drift = so_drift(so)
    p2 = analytics_p2.run(purchases, expenses)

    write_csv(creep, "signal_price_creep.csv")
    write_csv(pm, "signal_monthly_purchases.csv")
    write_csv(pcm, "signal_petty_cash_monthly.csv")
    write_csv(gap, "signal_petty_summary_gap.csv")
    write_csv(rab, "signal_petty_round_bias.csv")
    write_csv(drift, "signal_so_drift.csv")
    write_csv(p2["benford"], "signal_benford.csv")
    write_csv(p2["supplier_peer"], "signal_supplier_peer.csv")

    lines: list[str] = []
    lines.append("# Fraud-Signal Reconciliation Report — Funkydak 2026")
    lines.append("")
    lines.append("Generated by ykp/etl. No BOM required; BOM-level leak localization comes later.")
    lines.append("")

    lines.append("## 1. Supplier price-creep (>= 10% first->last)")
    if creep.empty:
        lines.append("- none detected")
    else:
        for _, r in creep.head(TOP_PRICE_JUMPS).iterrows():
            lines.append(
                f"- **{r['item_key']}** @ {r['supplier_key']}: Rp {r['first_price']:,.0f} ({r['first_date']}) "
                f"-> Rp {r['last_price']:,.0f} ({r['last_date']}) = **{r['change_pct']:+.1f}%** over {int(r['purchases'])} purchases"
            )
    lines.append("")

    lines.append("## 2. Petty-cash monthly flow (detail-sheet authoritative)")
    lines.append("| Month | Top-ups | Top-up total (Rp) | Expense total (Rp) | Net (Rp) |")
    lines.append("|---|---|---|---|---|")
    for _, r in pcm.iterrows():
        lines.append(f"| {r['month']} | {int(r['topups'])} | {r['topup_total']:,.0f} | {r['expense_total']:,.0f} | {r['net']:,.0f} |")
    lines.append("")

    lines.append("## 2b. DATA-INTEGRITY: summary sheet vs expense detail (top-ups)")
    lines.append("Top-ups recorded in expense detail but MISSING from the monthly summary sheet:")
    lines.append("| Month | Summary (Rp) | Detail (Rp) | Gap (Rp) |")
    lines.append("|---|---|---|---|")
    for _, r in gap.iterrows():
        flag = " **GAP**" if abs(r["gap"]) > 1 else ""
        lines.append(f"| {r['month']} | {r['summary_total']:,.0f} | {r['detail_total']:,.0f} | {r['gap']:+,.0f}{flag} |")
    lines.append("")

    lines.append("## 3. Petty-cash round-amount bias (fake-receipt heuristic)")
    lines.append("| Month | Lines | Round-amount lines | % |")
    lines.append("|---|---|---|---|")
    for _, r in rab.iterrows():
        flag = " **CHECK**" if r["round_pct"] > 30 else ""
        lines.append(f"| {r['month']} | {int(r['lines'])} | {int(r['round_lines'])} | {r['round_pct']}%{flag} |")
    lines.append("")

    lines.append("## 4. Stock opname drift (top movers, last two snapshots)")
    if drift.empty:
        lines.append("- not enough snapshots")
    else:
        prev_d, last_d = drift.iloc[0]["prev_date"], drift.iloc[0]["last_date"]
        lines.append(f"| Item | {prev_d} | {last_d} | Delta |")
        lines.append("|---|---|---|---|")
        for _, r in drift.head(15).iterrows():
            lines.append(f"| {r['item_key']} | {r['prev']:,.0f} | {r['last']:,.0f} | {r['delta']:+,.0f} |")
    lines.append("")

    lines.append("## 5. Food-cost inputs (join with Moka sales when API lands)")
    lines.append("| Month | Purchases value (Rp) |")
    lines.append("|---|---|")
    for _, r in pm.iterrows():
        lines.append(f"| {r['month']} | {r['purchases_value']:,.0f} |")
    lines.append("")
    lines.append("Formula: `food_cost_% = (SO_opening_value + purchases_value - SO_closing_value) / moka_sales` (KPI band 28-35%).")
    lines.append("Item prices needed to value SO snapshots: use latest unit_price from supplier_purchases.csv per item_key.")
    lines.append("")

    # P2 analytics sections
    mad = p2["benford_mad"]
    lines.append("## 6. Benford's Law (first-digit conformity, MAD < 0.015 = natural)")
    lines.append("| Dataset | MAD | Verdict |")
    lines.append("|---|---|---|")
    for k, v in mad.items():
        verdict = "**SUSPECT**" if v > analytics_p2.MAD_SUSPECT else "natural"
        lines.append(f"| {k} | {v} | {verdict} |")
    lines.append("")
    lines.append("Caveat: price-list data (fixed supplier catalogs) deviates from Benford by design;")
    lines.append("treat SUSPECT as 'review manually', not proof. Strongest on transaction amounts.")
    lines.append("")

    rb = p2["purchase_round_bias"]
    lines.append("## 7. Purchase round-amount bias")
    lines.append(f"- {rb['round_lines']} of {rb['lines']} purchase totals are round ({rb['round_pct']}%). >10% would be a review trigger.")
    lines.append("")

    lines.append("## 8. Supplier concentration (collusion surface)")
    lines.append("| Supplier | Orders | Spend (Rp) | Share | Items |")
    lines.append("|---|---|---|---|---|")
    for _, r in p2["supplier_peer"].head(10).iterrows():
        flag = " **HIGH**" if r["spend_share_pct"] > 40 else ""
        lines.append(f"| {r['supplier_key']} | {int(r['orders'])} | {r['total_spend']:,.0f} | {r['spend_share_pct']}%{flag} | {int(r['items'])} |")
    lines.append("")

    report = OUTPUT_DIR / "reconciliation_report.md"
    report.write_text("\n".join(lines), encoding="utf-8")
    print(f"  -> {report.name}")


if __name__ == "__main__":
    main()
