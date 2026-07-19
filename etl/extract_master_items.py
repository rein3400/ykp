"""A1: Master items — union of SO categories + Bahan Baku critical list.

Output schema aligned to warehouse master_item (subset of the 32 cols):
  item_id, item_code, item_name, category_id, item_type, base_unit,
  latest_purchase_price, minimum_stock, criticality,
  tolerance_variance_percentage, active_status, created_at, created_by
"""
from __future__ import annotations

import pandas as pd

from common import BAHAN_BAKU_FILE, norm_name, to_number, write_csv
from extract_stock_opname import extract as extract_so

COLS = [
    "item_key", "item_code", "item_name", "category_id", "base_unit",
    "latest_purchase_price", "minimum_stock", "tolerance_variance_percentage",
    "criticality", "notes",
]


def bahan_baku_critical() -> pd.DataFrame:
    """Critical items from owner's SOP file: code, name, unit, buy price, min stock, tolerance %."""
    df = pd.read_excel(BAHAN_BAKU_FILE, sheet_name="Master_Item", header=3)
    df = df.rename(columns={c: str(c).strip() for c in df.columns})
    df = df[df["Nama Item"].apply(norm_name) != ""]
    out = pd.DataFrame(
        {
            "item_key": df["Nama Item"].apply(norm_name),
            "item_code": df["Kode"].astype(str),
            "item_name": df["Nama Item"],
            "category_id": "critical",
            "base_unit": df["Satuan"],
            "latest_purchase_price": df["Harga Beli (Rp)"].apply(to_number),
            "minimum_stock": df["Stok Min"].apply(to_number),
            "tolerance_variance_percentage": df["Toleransi Selisih (%)"].apply(to_number),
            "criticality": "CRITICAL",
            "notes": df.get("Catatan", ""),
        }
    )
    return out[COLS]


def so_master_items() -> pd.DataFrame:
    """Item master derived from monthly stock-opname sheets."""
    so = extract_so()
    g = (
        so.sort_values("count_date")
        .groupby("item_key")
        .agg(item_name=("item_name", "first"), category_id=("category_key", "first"), base_unit=("unit", "first"))
        .reset_index()
    )
    g["item_code"] = ""
    g["latest_purchase_price"] = 0.0
    g["minimum_stock"] = 0.0
    g["tolerance_variance_percentage"] = 2.0  # owner default KPI
    g["criticality"] = "STANDARD"
    g["notes"] = ""
    return g[COLS]


def extract() -> pd.DataFrame:
    so_master = so_master_items()
    crit = bahan_baku_critical()

    merged = pd.concat([so_master, crit], ignore_index=True)
    # critical rows win on duplicate item_key
    merged["_crit"] = (merged["criticality"] == "CRITICAL").astype(int)
    merged = merged.sort_values(["item_key", "_crit"]).drop_duplicates("item_key", keep="last")
    merged = merged.drop(columns=["_crit"]).sort_values("item_key").reset_index(drop=True)

    merged.insert(0, "item_id", [f"ITM-{i + 1:04d}" for i in range(len(merged))])
    merged["item_type"] = "RAW_MATERIAL"
    merged["active_status"] = "active"
    merged["created_at"] = "2026-07-18"
    merged["created_by"] = "etl"

    out_cols = [
        "item_id", "item_code", "item_name", "category_id", "item_type", "base_unit",
        "latest_purchase_price", "minimum_stock", "criticality",
        "tolerance_variance_percentage", "active_status", "created_at", "created_by",
        "item_key", "notes",
    ]
    return merged[out_cols]


if __name__ == "__main__":
    df = extract()
    write_csv(df, "master_items.csv")
    print(f"items: {len(df)} (critical: {(df['criticality'] == 'CRITICAL').sum()})")
    print(df[df["criticality"] == "CRITICAL"][["item_code", "item_name", "base_unit", "latest_purchase_price", "tolerance_variance_percentage"]].to_string(index=False))
