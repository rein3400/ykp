"""P2 analytics — Hermez-style statistical fraud signals on real data.

Extends the reconciliation report with:

1. Benford's Law (first-digit distribution) on purchase unit prices and
   petty-cash debits. Fabricated/estimated numbers deviate from the natural
   distribution. MAD (mean absolute deviation) > 0.015 = suspicious per
   Nigrini's conformity thresholds.
2. Round-amount bias on PURCHASES (was petty-cash only). Weighed goods
   rarely produce round totals; fabricated invoices do.
3. Supplier peer stats: spend share, order frequency, avg order value per
   supplier — surfaces single-supplier dependency (collusion risk) and
   anomalous ordering cadence.
"""
from __future__ import annotations

import math
from collections import Counter

import pandas as pd

from common import write_csv

# Benford expected probabilities for first digits 1-9
BENFORD = {d: math.log10(1 + 1 / d) for d in range(1, 10)}
MAD_SUSPECT = 0.015  # Nigrini MAD threshold for nonconformity


def first_digit(v: float) -> int:
    v = abs(v)
    if v == 0:
        return 0
    while v < 1:
        v *= 10
    while v >= 10:
        v /= 10
    return int(v)


def benford_analysis(values: pd.Series, label: str) -> tuple[pd.DataFrame, float]:
    vals = [first_digit(v) for v in values if v > 0]
    vals = [v for v in vals if v > 0]
    n = len(vals)
    counts = Counter(vals)
    rows = []
    mad = 0.0
    for d in range(1, 10):
        actual = counts.get(d, 0) / n if n else 0
        expect = BENFORD[d]
        mad += abs(actual - expect) / 9
        rows.append({"digit": d, "actual_pct": round(actual * 100, 2), "benford_pct": round(expect * 100, 2), "dataset": label})
    return pd.DataFrame(rows), round(mad, 5)


def round_bias(values: pd.Series, mod: int = 50_000) -> tuple[int, int, float]:
    v = values[values > 0]
    if v.empty:
        return 0, 0, 0.0
    rounded = ((v % mod == 0) | (v % 100_000 == 0)).sum()
    return int(len(v)), int(rounded), round(rounded / len(v) * 100, 1)


def supplier_peer_stats(purchases: pd.DataFrame) -> pd.DataFrame:
    g = purchases.groupby("supplier_key").agg(
        orders=("purchase_id", "count"),
        total_spend=("total_amount", "sum"),
        avg_order=("total_amount", "mean"),
        items=("item_key", "nunique"),
        first=("order_date", "min"),
        last=("order_date", "max"),
    ).reset_index()
    total = g["total_spend"].sum()
    g["spend_share_pct"] = (g["total_spend"] / total * 100).round(1) if total else 0.0
    return g.sort_values("total_spend", ascending=False)


def run(purchases: pd.DataFrame, petty_expenses: pd.DataFrame) -> dict[str, pd.DataFrame | float | dict]:
    out: dict[str, pd.DataFrame | float | dict] = {}

    bf_p, mad_p = benford_analysis(purchases["unit_price"], "purchase_unit_price")
    bf_e, mad_e = benford_analysis(petty_expenses["debit"], "petty_cash_debit")
    out["benford"] = pd.concat([bf_p, bf_e], ignore_index=True)
    out["benford_mad"] = {"purchase_unit_price": mad_p, "petty_cash_debit": mad_e}

    n, r, pct = round_bias(purchases["total_amount"])
    out["purchase_round_bias"] = {"lines": n, "round_lines": r, "round_pct": pct}

    out["supplier_peer"] = supplier_peer_stats(purchases)
    return out


if __name__ == "__main__":
    purchases = pd.read_csv(__file__.replace("analytics_p2.py", "output\\supplier_purchases.csv"))
    petty = pd.read_csv(__file__.replace("analytics_p2.py", "output\\petty_cash_expenses.csv"))
    res = run(purchases, petty)
    print("Benford MAD:", res["benford_mad"], f"(suspect > {MAD_SUSPECT})")
    print("Purchase round bias:", res["purchase_round_bias"])
    print(res["supplier_peer"].head(10).to_string(index=False))
