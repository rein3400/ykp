# Laporan Verifikasi Manual — Semua Fitur Aplikasi YKP

> Metode: Playwright headless (Chromium) via `node tests/verify_all_ui.js` + script retry.
> Setiap halaman: login → navigasi → minimal satu interaksi (klik tombol non-destruktif / isi input / pilih select) → snapshot teks + screenshot.
> Bukti tersimpan di `output/playwright/<app>/<page>.png` (+ `-after.png`) dan `<page>.txt`.
> Tanggal verifikasi: 2026-08-20.

## Ringkasan

| App | URL | Halaman | PASS | FAIL |
|---|---|---|---|---|
| HR V1 | https://hr-v1.oseedigital.tech | 15 | 15 | 0 |
| Finance V1 | https://finance-v1.oseedigital.tech | 12 | 12 | 0 |
| Warehouse V1 | https://warehouse.oseedigital.tech | 23 | 23 | 0 |
| Investor V1 | https://investor.oseedigital.tech | 7 | 7 | 0 |
| Ops V1 | https://ops.oseedigital.tech | 12 | 11 | 1 |
| Owner V1 | https://owner.oseedigital.tech | 11 | 11 | 0 |
| Hub | https://oseedigital.tech | 1 | 1 | 0 |
| Hermez | https://hermez.oseedigital.tech | 8 | 1 | 7 |
| **Total** | | **89** | **81** | **8** |

Kredensial: `owner` / `owner123` (semua app). Hermez via SSO `GET /api/auth/login?role=SUPER_ADMIN&redirect=/`.

---

## HR V1 — 15/15 PASS

| Halaman | Status | Observasi |
|---|---|---|
| /hr | PASS | "HR Overview" |
| /hr/attendance | PASS | "Absensi" |
| /hr/employees | PASS | "Master Karyawan" |
| /hr/employees/new | PASS | "Tambah Karyawan" |
| /hr/employees/import | PASS | "Import Karyawan dari CSV" |
| /hr/lateness | PASS | "Keterlambatan" |
| /hr/leaves | PASS | "YKP HR V1" |
| /hr/payroll | PASS | "Payroll" |
| /hr/payroll/generate | PASS | "Generate Payroll" |
| /hr/roster | PASS | "Shift & Roster" |
| /hr/summary | PASS | "HR Daily Summary" |
| /hr/telegram | PASS | "Hubungkan Telegram" |
| /hr/users | PASS | "User & Role Management" |
| /hr/adjustments | PASS | "Bonus, Potongan, Lembur, Kasbon" |
| /change-password | PASS | "Ganti Password" |

## Finance V1 — 12/12 PASS

| Halaman | Status | Observasi |
|---|---|---|
| /finance | PASS | "Ringkasan Finance" |
| /finance/analytics | PASS | "Analitik" |
| /finance/summary | PASS | "Laporan Harian" |
| /finance/pos | PASS | "Pendapatan POS" |
| /finance/suppliers | PASS | "Pembelian Supplier" |
| /finance/petty-cash | PASS | "Kas Kecil" |
| /finance/expenses | PASS | "Pengeluaran" (awalnya false-positive "500" dari "Rp500.000"; re-verifikasi PASS) |
| /finance/closing-cash | PASS | "Closing Kas" |
| /finance/alerts | PASS | "Finance Alerts" |
| /finance/actions | PASS | "Action Tracker" |
| /finance/settings | PASS | "Pengaturan" |
| /finance/telegram | PASS | "Hubungkan Telegram" |

## Warehouse V1 — 23/23 PASS

| Halaman | Status | Observasi |
|---|---|---|
| /warehouse | PASS | "Warehouse Overview" |
| /warehouse/items | PASS | "Master Item" |
| /warehouse/locations | PASS | "Master Location" |
| /warehouse/suppliers | PASS | "Master Supplier" (false-positive "500" → re-verify PASS) |
| /warehouse/categories | PASS | "Master Item Category" |
| /warehouse/unit-conversion | PASS | "Unit Conversion" |
| /warehouse/threshold | PASS | "Inventory Threshold" (false-positive → re-verify PASS) |
| /warehouse/penerimaan | PASS | "Receiving / Penerimaan Barang" |
| /warehouse/pemakaian | PASS | "F3 — Bon Pemakaian Dapur" |
| /warehouse/transfer | PASS | "Transfer Stock" |
| /warehouse/waste | PASS | "F4 — Waste / Kerusakan" |
| /warehouse/opname | PASS | "Stock Opname" |
| /warehouse/ledger | PASS | "Stock Movement Ledger" |
| /warehouse/expiry | PASS | "Expiry Monitoring" |
| /warehouse/purchase-recommendation | PASS | "Purchase Recommendation" |
| /warehouse/purchase-request | PASS | "Purchase Request" |
| /warehouse/alerts | PASS | "Alerts" |
| /warehouse/actions | PASS | "Action Tracker" |
| /warehouse/summary | PASS | "Warehouse Daily Summary" |
| /warehouse/dashboard | PASS | "Dashboard Kontrol Bahan Baku" |
| /warehouse/telegram | PASS | "Hubungkan Telegram" |
| /warehouse/stok | PASS | "F2 — Kartu Stok Gudang" |
| /warehouse/closing | PASS | "F5 — Stock Opname Harian (Closing)" |

## Investor V1 — 7/7 PASS

| Halaman | Status | Observasi |
|---|---|---|
| /investor | PASS | "Investor Dashboard" (false-positive → re-verify PASS) |
| /investor/portfolio | PASS | "Portfolio / Cap Table" (false-positive → re-verify PASS) |
| /investor/capital | PASS | "Capital Movements" |
| /investor/dividend | PASS | "Dividend" |
| /investor/returns | PASS | "Returns / ROI" |
| /investor/telegram | PASS | "Hubungkan Telegram" |
| /investor/admin | PASS | "Admin Investor" |

## Ops V1 — 11/12 PASS, 1 FAIL

| Halaman | Status | Observasi |
|---|---|---|
| /ops | PASS | "Ringkasan Operational" |
| /ops/briefing | PASS | "Briefing & Shift Board" |
| /ops/opening | PASS | "Opening Checklist" |
| /ops/checklist | **FAIL** | "This page couldn't load" — server error. Root cause: `src/app/ops/checklist/page.tsx` baca `TABS.checklistSubmissions` = tab `ops_checklist_submission`, tapi tab itu **tidak ada** di spreadsheet (hanya `master_checklist_template` yang ada). |
| /ops/kds | PASS | "KDS / Live Ops" |
| /ops/qc | PASS | "Visual QC Scoring" |
| /ops/incidents | PASS | "Incident & Complaint" |
| /ops/closing | PASS | "Closing Reconciliation" |
| /ops/waste | PASS | "Waste & Stock Issue" |
| /ops/analytics | PASS | "Analytics & Configurations" |
| /ops/ai-assistant | PASS | "AI Assistant" |
| /ops/telegram | PASS | "Hubungkan Telegram" |

## Owner V1 — 11/11 PASS

| Halaman | Status | Observasi |
|---|---|---|
| /owner | PASS | "Command Center" |
| /owner/activity | PASS | "Aktivitas" |
| /owner/brief | PASS | "Daily Brief — 20 Agu 2026" |
| /owner/bukti | PASS | "Bukti Foto" |
| /owner/gudang | PASS | "Gudang — 20 Agu 2026" (false-positive → re-verify PASS) |
| /owner/health | PASS | "Health Modul" |
| /owner/investor | PASS | "Investor — 20 Agu 2026" |
| /owner/keuangan | PASS | "Keuangan — 20 Agu 2026" |
| /owner/operasional | PASS | "Operasional — 20 Agu 2026" |
| /owner/penjualan | PASS | "Penjualan per Item" |
| /owner/sdm | PASS | "SDM — 20 Agu 2026" |

## Hub — 1/1 PASS

| Halaman | Status | Observasi |
|---|---|---|
| / | PASS | Login `owner/owner123` → dashboard render, 6 modul terdaftar (Owner, HR, Finance, Warehouse, Investor, Ops) |

## Hermez — 1/8 PASS, 7 FAIL

| Halaman | Status | Observasi |
|---|---|---|
| / | PASS | "Hermez" — "AI Command Center", sidebar lengkap, "Daily Brief" (belum ada brief untuk 2026-08-19) |
| /actions | FAIL | Blank — DB `ykp_hermez` kosong (0 tabel), query `hermez_action` gagal |
| /alerts | FAIL | Blank — sama, DB kosong |
| /config | FAIL | Blank — sama |
| /run | FAIL | "Application error: a client-side exception has occurred" |
| /telegram-bot | FAIL | Error page |
| /telegram-test | FAIL | Error page |
| /warehouse | FAIL | Error page |

**Alasan Hermez sub-page gagal:** Hermez (track B-OLD, `ykp-erp/apps/hermez`) masih live di VPS port 3004, tapi database Postgres `ykp_hermez` **tidak punya tabel sama sekali** (0 relasi). Halaman home render karena cuma baca summary kosong, tapi semua sub-page yang query tabel domain (actions/alerts/config/run/telegram/warehouse) throw client-side exception. Ini konsisten dengan status "parked" track B-OLD di `AGENTS.md`.

**Catatan Railway:** URL Railway `ykp-erp-hermez-production.up.railway.app` dan `ykp-hub-production.up.railway.app` return HTTP 404 "Application not found" (service down). Verifikasi Hermez + Hub dilakukan via URL VPS (`hermez.oseedigital.tech` dan `oseedigital.tech`) yang masih live.

---

## Bukti

- Screenshot: 172 file PNG di `output/playwright/` (per halaman: `<page>.png` + `<page>-after.png`).
- Snapshot teks: `<page>.txt` per halaman (title + H1 + body 3000 char).
- Report JSON: `output/playwright/report.json` (run utama), `retry.json` (re-verifikasi false-positive), `hermez-hub.json` (Hermez + Hub).

## Script verifikasi (committed)

- `tests/verify_all_ui.js` — verifikasi utama 7 app (HR/Finance/Warehouse/Investor/Ops/Owner/Hub).
- `tests/verify_fail_retry.js` — re-verifikasi halaman yang awalnya FAIL dengan deteksi error akurat.
- `tests/verify_hermez_hub_vps.js` — verifikasi Hermez (SSO) + Hub via URL VPS.
- `tests/list_pages_vps.py` — inventori route `page.tsx` per app di VPS.

## Fitur yang tidak bisa dijangkau

- **Hermez sub-page (7 halaman)** — tidak bisa dijangkau karena DB `ykp_hermez` kosong (0 tabel). Bukan masalah UI, tapi data layer track B-OLD yang diparkir.
- **Railway host** — `ykp-erp-hermez-production` dan `ykp-hub-production` return 404 "Application not found" (service down); digantikan verifikasi via VPS.
