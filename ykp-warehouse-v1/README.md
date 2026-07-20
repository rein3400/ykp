# YKP Warehouse V1

Next.js 16 + Google Sheets inventory control app (see `YKP_ERP_Warehouse_Inventory_Developer_Brief_V1`).

## Local development

```bash
cp .env.example .env   # fill in service account + spreadsheet id
npm install
npm run dev            # http://localhost:3005
```

Set `USE_MOCK_DB=true` to run without Google Sheets (in-memory demo data,
login via `MOCK_PASSWORD` env var).

## Legacy F1–F5 deprecation (Review Cycle 2)

The flat legacy forms — F1 penerimaan, F3 bon pemakaian, F5 closing (plus the
read-only F2 kartu stok view) — are **deprecated** in favour of the structured
flows:

| Legacy | Replacement |
| --- | --- |
| F1 Penerimaan (`/api/warehouse/penerimaan`) | Transaksi › Receiving (header+detail, batch/expiry) |
| F3 Bon Pemakaian (`/api/warehouse/pemakaian`) | Transaksi › Stock Issue |
| F5 Closing (`/api/warehouse/closing`) | Transaksi › Stock Opname |
| F2 Kartu Stok (read-only) | Transaksi › Stock Ledger (immutable movement ledger) |

- Every legacy page shows a **"Mode legacy"** banner pointing at the new flow.
- Legacy **POST** writes are gated by `WAREHOUSE_LEGACY_WRITES_ENABLED`
  (default `true` for backward compatibility). Set it to `false` to make the
  legacy POST APIs return **HTTP 410 Gone** with a message pointing at the new
  flow. Legacy **reads** (migration views, summary fallback) are never
  affected.

## Daily summary

`POST /api/warehouse/summary/regenerate` rebuilds `warehouse_daily_summary`
for a date (default: today WIB). It is idempotent — the row is keyed by
`summary_id = WHS-<date>` and upserted, so re-running never duplicates rows.

KPIs aggregate the new flows first (receiving, transfer, stock-count, batch
stock, purchase engine). Legacy `f5_closing` variance is used only as a
fallback when no `warehouse_stock_count` data exists for the date.
`total_inventory_value` uses book stock × unit cost from
`warehouse_batch_stock` when cost data exists and falls back to the
`average_purchase_price × minimum_stock` proxy otherwise; the basis used is
recorded in the `value_basis` column.

`GET /api/warehouse/summary/count` is a public health endpoint for the
hub/owner dashboard: `{ data: { count, latest_date, earliest_date } }`.
