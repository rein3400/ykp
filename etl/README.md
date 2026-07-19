# YKP ETL — Owner Data Pack Ingestion + Fraud Signals

Converts the owner's real Excel reports into clean, analysis-ready CSVs and a
fraud-signal report. Companion to the P0 fraud controls in `ykp-warehouse-v1`.

## Inputs (read-only)

| File | Content |
|---|---|
| `C:\Users\user\Downloads\ykp excel report\Pengajuan Costing Funkydak 2026.xlsx` | Supplier purchases (913 rows, Jan–Jul 2026) |
| `C:\Users\user\Downloads\ykp excel report\Petty Cash Expense Funkydak 2026.xlsx` | Top-ups + 2,562 expense lines |
| `C:\Users\user\Downloads\ykp excel report\SO Funkydak 2026.xlsx` | Monthly stock opname, 217 items × 6 snapshots |
| `D:\YKP ERP\ykp\YKP Sistem Kontrol Bahan Baku v1.xlsx` | Owner SOP: critical items + tolerance % |

## Run

```bash
pip install pandas openpyxl
cd "D:\YKP ERP\ykp\etl"
python run_all.py
```

## Outputs (`output/`)

| File | Rows | Use |
|---|---|---|
| `master_items.csv` | 263 | Warehouse `master_item` seed (incl. 6 CRITICAL items w/ tolerance %) |
| `supplier_purchases.csv` | 913 | `purchases_value` for food-cost %, price history |
| `petty_cash_topups.csv` | 32 | Monthly top-up summary (as recorded) |
| `petty_cash_expenses.csv` | 2,562 | Line-item petty cash detail |
| `stock_opname.csv` | 1,303 | Monthly physical counts → opening/closing stock |
| `signal_price_creep.csv` | 25 | Fraud signal: supplier price inflation ≥ 10% |
| `signal_petty_summary_gap.csv` | 7 | Data-integrity: summary vs detail top-up gaps |
| `signal_petty_round_bias.csv` | 7 | Fake-receipt heuristic (round amounts) |
| `signal_so_drift.csv` | 214 | MoM counted-stock deltas |
| `reconciliation_report.md` | — | Human-readable fraud-signal digest |

## Key findings (2026-07-18 run)

1. **Summary-sheet gap (systematic, growing):** top-ups recorded in expense
   detail but missing from the monthly summary — Rp +12.5jt (Mar) growing to
   Rp +37.7jt (Apr). Sloppy bookkeeping or deliberate; either way the summary
   sheet cannot be trusted for reconciliation.
2. **Price-creep:** COKLAT BUBUK VAN HOUTEN @ BERLYAN FOOD +75% (2 purchases);
   BAKING POWDER +16.3% over 18 purchases; KNORR CHEESE +14.7%.
   GARAM MASALA +49900% is a unit-entry error (per-gram vs per-pack) — fix at source.
3. **Round-amount bias low** (2.7–5.2%) — no obvious fake-receipt pattern.
4. **Food-cost inputs ready:** monthly purchases Rp 21.5–64jt; join with Moka
   sales when the API pipeline lands (`food_cost_%` KPI band 28–35%).

## Notes / edge cases

- Duplicate item rows within one SO sheet: last entry kept (owner's correction).
- `petty_cash_topups.csv` (summary sheet) is incomplete by design of the
  source; authoritative top-ups are the `Additional Petty Cash` lines in
  `petty_cash_expenses.csv` (`is_topup = true`).
- Item matching across files uses normalized keys (`norm_name`): uppercase,
  accent-stripped, space-collapsed. Review `master_items.csv` before seeding.

## Next steps

1. Review `master_items.csv` → seed warehouse `master_item` tab:
   `cd ../ykp-warehouse-v1 && npm run seed:master-items` (idempotent by item name).
2. BOM table: `python make_bom_template.py` → owner fills `output/bom_template.csv`
   (ingredient keys in `output/bom_ingredient_reference.csv`). Warehouse tabs
   `master_recipe` / `master_recipe_item` are already in TAB_HEADERS — created
   on next `npm run sheets:bootstrap`.
3. Moka API ingestion: `python moka_ingest.py --from 2026-07-01 --to 2026-07-31`
   (needs MOKA_CLIENT_ID / MOKA_CLIENT_SECRET / MOKA_OUTLET_ID — see module docstring).
   Output `moka_sales.csv` joins with purchases + SO into
   `computeFoodCostPct()` / `evalFoodCostVariance()` (warehouse rules-engine,
   KPI band 28–35%, CRITICAL beyond ±5pp).
4. Fraud-watch block is live in the warehouse daily Telegram brief:
   today's waste count+value, adjustments pending/approved, receiving
   discrepancies, stale-approval count (see `collectFraudWatchData` /
   `composeFraudWatchBlock` in `ykp-warehouse-v1/src/lib/telegram.ts`).
