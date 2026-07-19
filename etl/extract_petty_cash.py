"""A3: Petty cash from 'Petty Cash Expense Funkydak 2026.xlsx'.

Two sheet kinds alternate per month:
  '<Month>'         : top-ups — Tanggal | Petty Cash | Outlet | PIC | status
  'Expense <Month>' : expenses — Tanggal | Items | Qty | <unit> | Debit | Kredit |
                      Saldo | Cash on Hand Sisa Saldo | Selisih
"""
from __future__ import annotations

import pandas as pd

from common import PETTY_CASH_FILE, norm_name, to_date, to_number, write_csv


def extract_topups(xl: pd.ExcelFile) -> pd.DataFrame:
    frames = []
    for sheet in xl.sheet_names:
        if sheet.lower().startswith("expense"):
            continue
        df = xl.parse(sheet, header=0)
        df = df.rename(columns={c: str(c).strip() for c in df.columns})
        if "Tanggal" not in df.columns or "Petty Cash" not in df.columns:
            continue
        out = pd.DataFrame(
            {
                "date": df["Tanggal"],
                "amount": df["Petty Cash"],
                "outlet": df.get("Outlet", "Demangan"),
                "pic": df.get("PIC", ""),
                "status": df.get("status", ""),
                "source_sheet": sheet,
            }
        )
        frames.append(out)
    df = pd.concat(frames, ignore_index=True)
    df["date"] = df["date"].apply(to_date)
    df["amount"] = df["amount"].apply(to_number)
    df = df[(df["date"] != "") & (df["amount"] > 0)].reset_index(drop=True)
    df.insert(0, "topup_id", [f"PCT-{i + 1:03d}" for i in range(len(df))])
    return df


def extract_expenses(xl: pd.ExcelFile) -> pd.DataFrame:
    frames = []
    for sheet in xl.sheet_names:
        if not sheet.lower().startswith("expense"):
            continue
        df = xl.parse(sheet, header=0)
        df = df.rename(columns={c: str(c).strip() for c in df.columns})
        if "Items" not in df.columns:
            continue
        month = sheet.replace("Expense", "").strip()
        out = pd.DataFrame(
            {
                "date": df.get("Tanggal", ""),
                "item_name": df["Items"],
                "qty": df.get("Qty", 0),
                "unit": df.iloc[:, 3] if df.shape[1] > 3 else "",
                "debit": df.get("Debit", 0),
                "kredit": df.get("Kredit", 0),
                "saldo": df.get("Saldo", 0),
                "month": month,
                "source_sheet": sheet,
            }
        )
        frames.append(out)
    df = pd.concat(frames, ignore_index=True)
    df = df[df["item_name"].apply(norm_name) != ""]
    # forward-fill dates within each month sheet (expense rows share the month date)
    df["date"] = df.groupby("source_sheet")["date"].ffill()
    df["date"] = df["date"].apply(to_date)
    for col in ("qty", "debit", "kredit", "saldo"):
        df[col] = df[col].apply(to_number)
    df["item_key"] = df["item_name"].apply(norm_name)
    df["is_topup"] = df["item_key"].str.contains("ADDITIONAL PETTY CASH", na=False)
    df = df.reset_index(drop=True)
    df.insert(0, "expense_id", [f"PCE-{i + 1:04d}" for i in range(len(df))])
    return df


if __name__ == "__main__":
    xl = pd.ExcelFile(PETTY_CASH_FILE)
    topups = extract_topups(xl)
    expenses = extract_expenses(xl)
    write_csv(topups, "petty_cash_topups.csv")
    write_csv(expenses, "petty_cash_expenses.csv")
    real = expenses[~expenses["is_topup"]]
    print(f"topups total: Rp {topups['amount'].sum():,.0f} over {len(topups)} top-ups")
    print(f"expense lines: {len(real)}, spend: Rp {real['debit'].sum():,.0f}")
