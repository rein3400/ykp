"""Run all ETL extractors + reconciliation report.

Usage:  python run_all.py
Output: ykp/etl/output/*.csv + reconciliation_report.md
"""
import report_reconciliation
from extract_costing import extract as extract_costing
from extract_master_items import extract as extract_master
from extract_petty_cash import extract_expenses, extract_topups
from extract_stock_opname import extract as extract_so
from common import PETTY_CASH_FILE, write_csv
import pandas as pd


def main() -> None:
    print("== A1 master items ==")
    write_csv(extract_master(), "master_items.csv")
    print("== A2 supplier purchases ==")
    write_csv(extract_costing(), "supplier_purchases.csv")
    print("== A3 petty cash ==")
    xl = pd.ExcelFile(PETTY_CASH_FILE)
    write_csv(extract_topups(xl), "petty_cash_topups.csv")
    write_csv(extract_expenses(xl), "petty_cash_expenses.csv")
    print("== A4 stock opname ==")
    write_csv(extract_so(), "stock_opname.csv")
    print("== A5 reconciliation ==")
    report_reconciliation.main()
    print("DONE")


if __name__ == "__main__":
    main()
