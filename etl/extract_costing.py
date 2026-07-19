"""A2: Supplier purchases from 'Pengajuan Costing Funkydak 2026.xlsx'.

Layout per sheet ('Januari-Maret (done)', 'Maret - Mei (done)', 'Mei - Juli'):
  row 1 (idx 1): title 'Pengajuan Costing Funkydak'
  row 2 (idx 2): header — No | Tanggal Order | Description | Demangan | Supplier Name |
                 Size | Quantity | Amount | Discount | Tax | Total Amount |
                 Supplier Account Name | Account No. | Bank | Deadline | Status | Date | Remark
  row 3 (idx 3): totals row (skipped)
  row 5+       : data
"""
from __future__ import annotations

import pandas as pd

from common import COSTING_FILE, norm_name, to_date, to_number, write_csv

COLUMNS = {
    "No": "seq",
    "Tanggal Order": "order_date",
    "Description": "item_name",
    "Demangan": "outlet",
    "Supplier Name": "supplier_name",
    "Size": "size",
    "Quantity": "quantity",
    "Amount": "unit_price",
    "Discount": "discount",
    "Tax": "tax",
    "Total Amount": "total_amount",
    "Supplier Account Name": "supplier_account_name",
    "Account No.": "account_no",
    "Bank": "bank",
    "Deadline": "deadline",
    "Status": "payment_status",
    "Date": "payment_date",
    "Remark": "remark",
}


def extract() -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    xl = pd.ExcelFile(COSTING_FILE)
    for sheet in xl.sheet_names:
        raw = xl.parse(sheet, header=2)
        raw = raw.rename(columns={c: str(c).strip() for c in raw.columns})
        keep = [c for c in COLUMNS if c in raw.columns]
        df = raw[keep].rename(columns=COLUMNS)
        df["source_sheet"] = sheet
        frames.append(df)

    df = pd.concat(frames, ignore_index=True)
    # drop blank / totals rows
    df = df[df["item_name"].apply(norm_name) != ""]
    df = df[df["item_name"].apply(norm_name) != "DESCRIPTION"]

    df["order_date"] = df["order_date"].apply(to_date)
    df["payment_date"] = df["payment_date"].apply(to_date)
    for col in ("quantity", "unit_price", "discount", "tax", "total_amount"):
        df[col] = df[col].apply(to_number)
    df["item_key"] = df["item_name"].apply(norm_name)
    df["supplier_key"] = df["supplier_name"].apply(norm_name)
    df["payment_status"] = df["payment_status"].fillna("").astype(str).str.strip().str.lower()
    df["outlet"] = df["outlet"].fillna("Demangan").astype(str).str.strip()

    df = df[df["order_date"] != ""].reset_index(drop=True)
    df.insert(0, "purchase_id", [f"PUR-{i + 1:04d}" for i in range(len(df))])
    return df


if __name__ == "__main__":
    df = extract()
    write_csv(df, "supplier_purchases.csv")
    print(f"suppliers: {df['supplier_key'].nunique()}, items: {df['item_key'].nunique()}")
    print(f"date range: {df['order_date'].min()} -> {df['order_date'].max()}")
    print(f"total spend: Rp {df['total_amount'].sum():,.0f}")
