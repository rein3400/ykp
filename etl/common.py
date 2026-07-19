"""Shared helpers for YKP ETL extractors."""
from __future__ import annotations

import re
import unicodedata
from datetime import datetime
from pathlib import Path

import pandas as pd

DATA_DIR = Path(r"C:\Users\user\Downloads\ykp excel report")
BAHAN_BAKU_FILE = Path(r"D:\YKP ERP\ykp\YKP Sistem Kontrol Bahan Baku v1.xlsx")
OUTPUT_DIR = Path(__file__).resolve().parent / "output"

COSTING_FILE = DATA_DIR / "Pengajuan Costing Funkydak 2026.xlsx"
PETTY_CASH_FILE = DATA_DIR / "Petty Cash Expense Funkydak 2026.xlsx"
SO_FILE = DATA_DIR / "SO Funkydak 2026.xlsx"


def norm_name(s: object) -> str:
    """Normalize an item/supplier name for matching: uppercase, strip accents, collapse spaces."""
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    t = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    t = re.sub(r"\s+", " ", t).strip().upper()
    return t


def to_number(v: object) -> float:
    """Parse a number from messy Excel cells: '1.000.000', 'Rp 45.000', '2,5', 1000.0 -> float."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    t = str(v).strip()
    if not t or t.lower() in {"nan", "-", ""}:
        return 0.0
    t = re.sub(r"[^\d,.\-]", "", t)
    if not t:
        return 0.0
    # Indonesian format: 1.234.567,89 -> 1234567.89 ; plain 1,000.5 ambiguous -> treat . as thousands if no comma
    if "," in t and "." in t:
        t = t.replace(".", "").replace(",", ".")
    elif "." in t and t.count(".") > 1:
        t = t.replace(".", "")
    elif "," in t:
        t = t.replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return 0.0


def to_date(v: object) -> str:
    """Parse a date cell to ISO YYYY-MM-DD. Returns '' when unparseable."""
    if v is None:
        return ""
    try:
        if pd.isna(v):
            return ""
    except (TypeError, ValueError):
        pass
    if isinstance(v, (datetime, pd.Timestamp)):
        return v.strftime("%Y-%m-%d")
    t = str(v).strip()
    if not t or t.lower() in {"nan", "nat", "none"}:
        return ""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %B %Y"):
        try:
            return datetime.strptime(t, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    # pandas fallback
    try:
        ts = pd.to_datetime(t)
        if pd.isna(ts):
            return ""
        return ts.strftime("%Y-%m-%d")
    except Exception:
        return ""


def write_csv(df: pd.DataFrame, name: str) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUTPUT_DIR / name
    df.to_csv(out, index=False)
    print(f"  -> {out.name}: {len(df)} rows, {len(df.columns)} cols")
    return out
