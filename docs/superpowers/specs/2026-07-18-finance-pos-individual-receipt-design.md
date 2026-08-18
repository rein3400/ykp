# Design: Finance POS Individual Receipt + Foto Nota

> **Scope:** POS revenue module in `ykp-erp/apps/finance`.  
> **Date:** 2026-07-18  
> **Status:** approved for implementation

---

## Goal

Replace the daily-aggregate `fin_pos_daily` source of truth with individual receipt records (`fin_pos_receipts`), keep the daily summary available via a database view, and add a photographed receipt image per transaction so every daily total is auditable down to the source invoice.

---

## Current State

- `fin_pos_daily` stores one row per `(date, outlet)` with aggregates: gross, net, discount, refund, void, tax, service, payment breakdown, tx count, AOV, cashier, shift, source, sourceRef, notes, recordedBy.
- CSV Moka import aggregates receipts into daily rows in `fin_pos_daily`.
- Manual form creates one daily aggregate row.
- UI shows a table of daily rows with no drill-down, no image proof, and no per-receipt audit trail.

---

## Target State

### Schema

**New table: `finance.fin_pos_receipts`** (source of truth)

| Column | Type | Notes |
|---|---|---|
| `receipt_id` | text PK | stable ID, e.g. `RCP-YYYYMMDD-OL-NNNN` |
| `date` | date | WIB date |
| `brand_id` | text | from master |
| `brand_name` | text | denormalized |
| `outlet_id` | text | from master |
| `outlet_name` | text | denormalized |
| `receipt_number` | text | POS receipt / invoice number |
| `transaction_time` | text | optional, time from Moka |
| `gross_sales` | integer | in IDR sen |
| `discount` | integer | |
| `refund` | integer | |
| `void` | integer | |
| `tax` | integer | |
| `service_charge` | integer | |
| `net_sales` | integer | computed: gross - discount - refund - void |
| `payment_method_id` | text | FK to master.fin_payment_method (app-resolved) |
| `payment_amount` | integer | |
| `payment_breakdown` | jsonb | `{method_id: amount}` if multi-method |
| `transaction_count` | integer | usually 1 per receipt, kept for Moka rows that are already aggregates |
| `cashier` | text | |
| `shift` | text | |
| `source` | enum | moka / manual |
| `source_ref` | text | Moka receipt id, etc. |
| `notes` | text | |
| `photo_url` | text | Supabase Storage public URL |
| `photo_path` | text | internal Supabase path |
| `verified_by` | text | user id |
| `verified_at` | timestamp | |
| `recorded_by` | text | user id |
| `recorded_at` | timestamp | default now |
| `created_at` / `updated_at` | timestamp | |

**New table: `finance.fin_pos_receipt_photos`** (optional, if multiple photos per receipt are needed later)

For V1 we keep one photo per receipt (`photo_url` on the receipt). This table is reserved for future multi-photo support.

**View: `finance.fin_pos_daily_view`**

Materialized view (or regular view if row count < 100k) that aggregates `fin_pos_receipts` by `(date, outlet_id)` to match the existing `fin_pos_daily` columns exactly.

**Migrate existing `fin_pos_daily` data:**
- One-time migration: convert each existing `fin_pos_daily` row into a single `fin_pos_receipts` row with `transaction_count`, `gross_sales`, etc. copied as-is, source preserved.
- After migration, drop `fin_pos_daily` table or rename it to `fin_pos_daily_legacy` and replace references with the view.

### Import pipeline (Moka CSV)

- `parseMokaCsv` in `packages/engine` must be updated to return one object per receipt line in the CSV.
- Import route inserts into `fin_pos_receipts` one row per parsed receipt.
- Duplicate detection by `(date, outlet_id, receipt_number)`.
- If a daily aggregate already exists for the same `(date, outlet)`, do not block; just insert the receipt rows. The view will recompute the aggregate.
- Existing variance tolerance (5%) logic can be removed or replaced with a receipt-level duplicate/override check.

### Manual entry UI

- Add a receipt form with fields: date, outlet, receipt number, gross, discount, refund, void, tax, service, payment method + amount, cashier, shift, source, notes.
- Photo upload: drag-drop or file input, preview, upload to Supabase bucket `pos-receipts`.
- Submit creates one row in `fin_pos_receipts`.
- The POS daily page continues to show daily aggregates but now from the view; clicking a row opens a drawer/modal listing receipts for that day/outlet.

### Verification / anti-fraud

- `verified_by` / `verified_at` filled by a user with `FINANCE_ADMIN` / `OWNER` role clicking "Verify" on a receipt.
- After verified, amount fields become read-only unless a separate "Override with reason" flow is used.
- Audit log writes `fin_pos_receipt:created`, `fin_pos_receipt:verified`, `fin_pos_receipt:overridden` to `finance.audit_log`.
- Duplicate receipt detection returns 409 with the existing receipt id.

### Storage

- Supabase Storage bucket `pos-receipts`, public read for authenticated users.
- Upload path: `pos-receipts/{outlet_id}/{date}/{receipt_id}-{random}.{ext}`
- Max 10 MB per file, image only (jpg/png/webp), resize to max 1920px on the longest side before upload.

### API surface

- `GET /api/fin/pos` → list from `fin_pos_daily_view` (same query params as today, same response shape, backwards compatible).
- `GET /api/fin/pos/receipts?date=&outlet_id=` → list individual receipts.
- `GET /api/fin/pos/receipts/[id]` → single receipt detail including photo_url.
- `POST /api/fin/pos/receipts` → create manual receipt.
- `POST /api/fin/pos/receipts/[id]/verify` → mark verified.
- `POST /api/fin/pos/import` → updated Moka import; returns per-receipt insert summary.
- `DELETE /api/fin/pos/receipts/[id]` → soft delete (optional V1; hard delete with audit log if simpler).

### Testing

- Unit test `parseMokaCsv` returns per-receipt rows.
- API test: create receipt, verify aggregate view updates.
- API test: duplicate receipt returns 409.
- API test: upload photo returns public URL and path.
- tsc clean across `finance`, `engine`, `schema`.

---

## Out of Scope (V1)

- Multi-photo per receipt (can be added later with `fin_pos_receipt_photos`).
- OCR of receipt images.
- Moka API direct integration (CSV only).
- Real-time sync.

---

## Files to Touch (high-level)

- `ykp-erp/packages/schema/src/finance.ts` — new schema, view, drop old table.
- `ykp-erp/packages/schema/src/migrate.ts` — add migration sequence.
- `ykp-erp/packages/engine/src/moka-importer.ts` — parse per receipt.
- `ykp-erp/apps/finance/src/app/api/fin/pos/import/route.ts` — insert receipts.
- `ykp-erp/apps/finance/src/app/api/fin/pos/receipts/route.ts` — new.
- `ykp-erp/apps/finance/src/app/api/fin/pos/receipts/[id]/route.ts` — new.
- `ykp-erp/apps/finance/src/app/api/fin/pos/receipts/[id]/verify/route.ts` — new.
- `ykp-erp/apps/finance/src/features/finance/api/types.ts` — add receipt types.
- `ykp-erp/apps/finance/src/features/finance/api/queries.ts` — add receipt query hooks.
- `ykp-erp/apps/finance/src/features/finance/api/mutations.ts` — add receipt mutations.
- `ykp-erp/apps/finance/src/features/finance/api/service.ts` — add receipt service calls.
- `ykp-erp/apps/finance/src/features/finance/components/pos-receipt-table.tsx` — new.
- `ykp-erp/apps/finance/src/features/finance/components/pos-receipt-form.tsx` — new, with photo upload.
- `ykp-erp/apps/finance/src/features/finance/components/pos-photo-upload.tsx` — new.
- `ykp-erp/apps/finance/src/app/(dashboard)/pos/page.tsx` — add drill-down.
- `ykp-erp/apps/finance/src/lib/supabase.ts` — new Supabase client for storage (if not already).
- `ykp-erp/packages/config/src/index.ts` — add Supabase storage bucket name.

---

## Risks

- **Data migration:** existing `fin_pos_daily` rows must be migrated before view swap; do this in a single transaction with advisory lock.
- **Backwards compatibility:** Hermez and analytics read `fin_pos_daily`. Use the view with identical column names to avoid breakage.
- **Performance:** if receipt volume grows > 100k, materialize the view and schedule refresh. Start with regular view.
- **Storage costs:** public bucket for receipt photos needs RLS policy; don't allow anonymous uploads.

---

## Approved By

User confirmed via chat: "execute" after design walkthrough.
