# YKP Finance V1

Finance Module V1 per `YKP_ERP_Finance_Developer_Brief_V1.txt` + `YKP_ERP_List_Revisi_Developer.txt` + `blueprint/YKP_Hermez_Migration_Blueprint.md`.

## Stack

- **Next.js 16** (App Router) + TypeScript strict, port **3003**
- **Google Sheets API** as the source-of-truth database (brief V1 explicitly allows spreadsheet DB)
- Service-account JWT auth (googleapis), mock-store fallback when env missing
- HS256 cookie session (edge middleware), 7-role RBAC, audit log, Telegram delivery log
- Tailwind, sonner toasts, oxlint, vitest

## Why Google Sheets for V1

Brief V1: "Database awal: Untuk V1 boleh menggunakan Google Sheet / Spreadsheet Database".
Owner dapat edit manual, tidak butuh DB server, audit log sheet, FK-validation di app layer.

## Quick start

```bash
# 1. GCP: create project -> IAM -> Service Account -> JSON key
# 2. Create a Google Spreadsheet, share it with the service-account email (Editor)
cp .env.example .env
# fill GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (with \n escapes),
# YKP_FINANCE_SPREADSHEET_ID, SESSION_SECRET (32+ chars)

npm.cmd install
npm.cmd run sheets:bootstrap     # create all tabs + headers + seed masters + thresholds + owner user
npm.cmd run sheets:smoke         # write+read roundtrip check
npm.cmd run dev                  # http://localhost:3003  (login: owner / owner123 — GANTI sebelum pilot)
```

Tanpa `.env` (atau `USE_MOCK_DB=true`) app berjalan penuh di **mock-store** dengan data contoh:
5 brand, 7 outlet, 10 supplier, 14 hari POS/petty/expense/supplier/closing — termasuk satu
refund day, satu cash-diff day (Rp75.000 → alert HIGH), petty over limit, dan expense spike.

## Scripts

| Script | Fungsi |
|---|---|
| `dev` | next dev -p 3003 |
| `build` / `start` | production build / start |
| `lint` | oxlint |
| `test` | vitest run (pure calc libs) |
| `sheets:bootstrap` | idempotent: buat semua tab + header + seed master/threshold/user |
| `sheets:smoke` | tulis+baca 1 baris fin_pos_daily |
| `sheets:seed-user` | seed owner/owner123 |

## Pages (Bahasa Indonesia)

`/finance` Ringkasan (owner KPI) · `/finance/pos` Pendapatan POS (list + manual + import Moka CSV + validasi settlement) · `/finance/suppliers` Pembelian Supplier (costing, aging, approve-payment) · `/finance/petty-cash` Kas Kecil (running balance per akun) · `/finance/expenses` Pengeluaran · `/finance/closing-cash` Closing Kas (fisik vs sistem) · `/finance/summary` Laporan Harian (fin_daily_summary + regenerate) · `/finance/analytics` Analitik · `/finance/alerts` + `/finance/actions` · `/finance/settings` (master data + threshold config) · `/login`

## API highlights

- `GET /api/finance/summary` — **public** (Hermez/owner hub), filter `date`, `outlet_id`, `brand_id`
- `GET /api/finance/summary/count` — **public** health check untuk hub launcher
- `POST /api/finance/summary/regenerate` — protected (finance_admin+): hitung fin_daily_summary per (date, outlet), jalankan finance alert rules, upsert `finance_alert_log` (ID deterministik), auto-create `finance_action_tracker` untuk HIGH/CRITICAL
- CRUD + approval: `/api/finance/pos` (+`/import`), `/suppliers` (+`/[id]/approve-payment`), `/petty-cash` (+`/[id]/approve`, `/balance`), `/expenses` (+`/[id]/approve`), `/closing-cash`, `/thresholds`, `/master-data`

## Aturan penting (dari Revisi)

1. **#3 — JANGAN pakai label "Net Profit".** Yang dihitung adalah **Estimasi Surplus Kas** (`estimated_surplus = net_sales − expense − supplier_cost − petty_cash_out`). Net Profit baru boleh dipakai setelah ada actual COGS (opening + purchase − closing inventory).
2. **#4 — Anti double-count.** Transaction tabs punya `source_module`, `source_transaction_id`, `payment_source`, `linked_expense_id`, `linked_supplier_invoice_id`, `linked_petty_cash_id`. Summary engine mengecualikan baris yang sudah terwakili oleh link (supplier linked ke expense dikeluarkan dari supplier_cost; petty linked ke expense/supplier dikeluarkan dari petty_cash_out). Bayar invoice via kas kecil otomatis membuat baris petty yang ter-link.
3. **#5 — Settlement validation.** fin_pos_daily punya `settle_cash/qris/card/transfer/marketplace`, `total_settlement`, `settlement_difference` (signed: net − total). Mismatch di atas toleransi → alert.
4. **#10 — Threshold config di Sheets** (`finance_threshold_config`: key, label, penjelasan, value, unit, severity, scope GLOBAL/BRAND/OUTLET, active, last_changed, changed_by), dipakai rules engine, editable via UI dengan audit before/after.
5. CANCELLED/REJECTED tidak pernah dihitung. Semua uang integer IDR. Semua tanggal Asia/Jakarta.

## Env

Lihat `.env.example`. Jangan pernah commit `.env` atau `gcp-service-account*.json` (sudah di-gitignore).
