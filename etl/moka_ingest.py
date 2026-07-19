"""N4: Moka POS ingestion scaffold (anti-fraud: independent sales source).

Moka is the POS of record. Employees cannot fabricate Moka data from inside
the ERP — so Moka sales are the INDEPENDENT source for the two
reconciliations in the anti-fraud blueprint:

  A. food_cost_% = (SO_opening + purchases - SO_closing) / moka_sales  (28-35%)
  B. expected_cash = opening_float + moka_cash_sales - moka_refunds

SETUP (one-time, owner action required):
  1. Moka Back Office -> Settings -> Integrations -> create app credentials
     (Moka Open API, OAuth2 client credentials).
  2. Set env vars:
       MOKA_CLIENT_ID, MOKA_CLIENT_SECRET, MOKA_OUTLET_ID
  3. Run:  python moka_ingest.py --from 2026-07-01 --to 2026-07-31

OUTPUT: output/moka_sales.csv — date, outlet_id, gross_sales, cash_sales,
refunds, voids, transactions (daily grain, ready for reconciliation).

NOTE: This scaffold intentionally contains no live call until credentials
exist; with no env config it exits with a clear setup message. Endpoint
shapes follow Moka Open API v1 (api.mokapos.com); adjust paths if your
merchant account uses the newer /v2 namespace.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import pandas as pd

from common import OUTPUT_DIR, write_csv

TOKEN_URL = "https://api.mokapos.com/oauth/token"
API_BASE = "https://api.mokapos.com/v1"


def moka_config_ok() -> bool:
    return bool(os.environ.get("MOKA_CLIENT_ID") and os.environ.get("MOKA_CLIENT_SECRET"))


def fetch_token(client_id: str, client_secret: str) -> str:
    import urllib.request
    import json

    req = urllib.request.Request(
        TOKEN_URL,
        data=json.dumps(
            {"grant_type": "client_credentials", "client_id": client_id, "client_secret": client_secret}
        ).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())["access_token"]


def fetch_transactions(token: str, outlet_id: str, date_from: str, date_to: str) -> list[dict]:
    """Pull completed transactions per outlet per date range (paginated)."""
    import urllib.request
    import json

    rows: list[dict] = []
    page = 1
    while True:
        url = (
            f"{API_BASE}/outlets/{outlet_id}/transactions"
            f"?start_date={date_from}&end_date={date_to}&status=completed&page={page}&per_page=100"
        )
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=60) as res:
            payload = json.loads(res.read())
        batch = payload.get("data", [])
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return rows


def to_daily_sales(txns: list[dict], outlet_id: str) -> pd.DataFrame:
    """Transform raw Moka transactions to daily-grain sales for reconciliation."""
    records = []
    for t in txns:
        # Field names per Moka v1 transaction object; adjust to actual payload.
        payments = t.get("payments", [])
        cash = sum(p.get("amount", 0) for p in payments if p.get("type") == "cash")
        records.append(
            {
                "date": str(t.get("created_at", ""))[:10],
                "outlet_id": outlet_id,
                "gross_sales": t.get("total_amount", 0),
                "cash_sales": cash,
                "refunds": t.get("refund_amount", 0),
                "voids": 1 if t.get("is_voided") else 0,
                "transactions": 1,
            }
        )
    df = pd.DataFrame(records)
    if df.empty:
        return df
    return df.groupby(["date", "outlet_id"], as_index=False).sum(numeric_only=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="date_from", required=True)
    ap.add_argument("--to", dest="date_to", required=True)
    args = ap.parse_args()

    if not moka_config_ok():
        print("Moka not configured. Set MOKA_CLIENT_ID / MOKA_CLIENT_SECRET / MOKA_OUTLET_ID.")
        print("See module docstring for one-time setup steps.")
        sys.exit(2)

    outlet_id = os.environ["MOKA_OUTLET_ID"]
    token = fetch_token(os.environ["MOKA_CLIENT_ID"], os.environ["MOKA_CLIENT_SECRET"])
    txns = fetch_transactions(token, outlet_id, args.date_from, args.date_to)
    print(f"fetched {len(txns)} transactions")

    daily = to_daily_sales(txns, outlet_id)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    write_csv(daily, "moka_sales.csv")
    print("next: join moka_sales.csv with signal_monthly_purchases.csv + stock_opname.csv")
    print("      -> computeFoodCostPct() in warehouse rules-engine")


if __name__ == "__main__":
    main()
