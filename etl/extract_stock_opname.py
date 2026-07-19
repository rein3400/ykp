"""A4: Stock opname monthly counts from 'SO Funkydak 2026.xlsx'.

Layout per sheet ('5 Februari 2026', '3 Maret 2026', ...):
  row 0: header — Internal ID (DO NOT EDIT) | Name | Category | In Stock (DO NOT EDIT) | Unit
  row 1+: data. Item rows have empty Internal ID in this export.
"""
from __future__ import annotations

import re
from datetime import datetime

import pandas as pd

from common import SO_FILE, norm_name, to_number, write_csv

MONTH_ID = {
    "januari": "01", "februari": "02", "maret": "03", "april": "04",
    "mei": "05", "juni": "06", "juli": "07", "agustus": "08",
    "september": "09", "oktober": "10", "november": "11", "desember": "12",
}

UNIT_MAP = {
    "gram (g)": "g",
    "mililiter (ml)": "ml",
    "pieces (pcs)": "pcs",
    "kilogram (kg)": "kg",
    "liter (l)": "l",
}

CATEGORY_MAP = {
    "BAHAN UTAMA MINUMAN": "beverage_main",
    "BAHAN UTAMA MAKANAN": "food_main",
    "SAUCE": "sauce",
    "BUMBU MARINASI": "marinade",
    "BAHAN PELENGKAP": "condiment",
}


def sheet_date(sheet: str) -> str:
    m = re.match(r"(\d{1,2})\s+(\w+)\s+(\d{4})", sheet.strip())
    if not m:
        return ""
    day, mon, year = m.group(1), m.group(2).lower(), m.group(3)
    mm = MONTH_ID.get(mon, "00")
    return f"{year}-{mm}-{int(day):02d}"


def extract() -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    xl = pd.ExcelFile(SO_FILE)
    for sheet in xl.sheet_names:
        df = xl.parse(sheet, header=0)
        df = df.rename(columns={c: str(c).strip() for c in df.columns})
        name_col = next((c for c in df.columns if c.lower() == "name"), None)
        cat_col = next((c for c in df.columns if c.lower() == "category"), None)
        stock_col = next((c for c in df.columns if "in stock" in c.lower()), None)
        unit_col = next((c for c in df.columns if c.lower() == "unit"), None)
        if not name_col or not stock_col:
            continue
        out = pd.DataFrame(
            {
                "item_name": df[name_col],
                "category": df[cat_col] if cat_col else "",
                "qty_counted": df[stock_col],
                "unit_raw": df[unit_col] if unit_col else "",
            }
        )
        out["count_date"] = sheet_date(sheet)
        out["source_sheet"] = sheet
        frames.append(out)

    df = pd.concat(frames, ignore_index=True)
    df = df[df["item_name"].apply(norm_name) != ""]
    df["item_key"] = df["item_name"].apply(norm_name)
    df["qty_counted"] = df["qty_counted"].apply(to_number)
    df["unit"] = df["unit_raw"].astype(str).str.strip().str.lower().map(UNIT_MAP).fillna("pcs")
    df["category_key"] = df["category"].apply(norm_name).map(CATEGORY_MAP).fillna("other")
    df = df[df["count_date"] != ""].reset_index(drop=True)
    return df[["item_key", "item_name", "category_key", "count_date", "qty_counted", "unit", "source_sheet"]]


if __name__ == "__main__":
    df = extract()
    write_csv(df, "stock_opname.csv")
    print(f"items: {df['item_key'].nunique()}, count dates: {sorted(df['count_date'].unique())}")
