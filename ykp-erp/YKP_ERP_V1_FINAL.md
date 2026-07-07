# YKP ERP V1 — Final State (OLD TRACK, parked)

> Status per 2026-07-07. Track ini di-park. Lanjutan = HR V1 (Google Sheets) di `ykp-hr-v1/`.

## Yang sudah dibangun

Monorepo `ykp-erp/` (Node 22 + TS strict + Next.js 14 + Drizzle + Postgres 4-DB):
- `packages/schema` — master/hr/finance/hermez/system + migrate + seed
- `packages/engine` — payroll, attendance, hr-summary, fin-summary, moka-importer, approval, hermez-brief, triggers, telegram, cron, audit, id-gen, lookup
- `packages/auth` — signed JWS session (HS256, 24h, strict SameSite) + RBAC matrix
- `packages/config` — env + timezone + currency constants
- `packages/format` — leaf package (formatIdr, formatDateWib) untuk hindarin engine→ui inversion
- `apps/hr` — HR app + API routes + client features + vitest smoke
- `apps/finance` — 16 API routes + 9 dashboard pages + client features + vitest smoke
- `apps/hermez` — brief/alerts/config/run/telegram-test routes + brief-cron worker

## Verify pass terakhir (re-verify v4)

- **H (HR): PASS** ✓
- **F (Finance): FAIL** — 10 CRITICAL/HIGH
- **Z (Hermez): FAIL** — residual
- **Security: FAIL** — residual
- **Integration: FAIL** — residual
- Total: 14 CRITICAL/HIGH, 63 MEDIUM/LOW

## Known residuals (14 CRITICAL/HIGH, tidak difix — V2 follow-up)

### Finance lane (F)
1. **POS/expense/supplier/closing-cash/petty-cash seq allocation global-per-date, bukan per-outlet-per-date** — `apps/finance/src/app/api/fin/pos/route.ts:93`, `expense/route.ts:76`, `supplier/route.ts:74`, `closing-cash/route.ts:62`, `petty-cash/route.ts:93`. Contract `FIN-YYYYMMDD-NNN` seq per outlet per date dilanggar. Fix: filter `where(and(eq(date), eq(outletId)))` sebelum count.
2. **CSV import size limit pakai string length bukan byte length** — `apps/finance/src/app/api/fin/pos/import/route.ts:35`. DoS vector: multi-byte UTF-8 body bypass cap. Fix: pakai `Buffer.byteLength(csvText)`.
3. **Moka import sequence-counter query load seluruh tabel tanpa WHERE** — `pos/import/route.ts:147`. O(n) memory blow-up. Fix: scope ke dates being imported.
4. **Existing-row matching by inArray(date) fragile** — `pos/import/route.ts:93`. Drizzle date column return Date, key reconstruction asumsi string. Fix: normalize ke YYYY-MM-DD string consistently.
5. **parseIdrAmount reject negative, drop row refund/void** — `packages/engine/src/moka-importer.ts:99`. Data loss untuk legitimate Moka refund correction. Fix: allow negative untuk refund/void columns.
6. **Profit analytics sum supplier_cost + expense tanpa exclude CANCELLED/REJECTED** — `apps/finance/src/app/api/fin/analytics/profit/route.ts:79`. Voided cost inflate expense. Fix: filter `where(ne(approvalStatus, 'CANCELLED'))`.

### Hermez lane (Z)
7. **generateBriefForDate upsert reset sentToOwner=false/sentAt=null setiap regen** — `packages/engine/src/hermez-brief.ts:361`. Duplicate owner notification saat manual re-run. Fix: onConflictDoUpdate jangan overwrite sentToOwner/sentAt kalau sudah true.
8. **hermezAlertId format deviate dari contract** — `hermez-brief.ts:205`. Fix: align ke `HZAL-YYYYMMDD-NNN`.

### Security lane
9-14. Residual security findings (lihat journal.jsonl untuk detail — RBAC scope edge cases, error envelope leakage di beberapa route, file upload validation).

> Detail lengkap: `C:\Users\stefa\AppData\Local\Temp\claude\...\tasks\wk27zb7ec.output` + `journal.jsonl` workflow `wf_c0c55b67-16e`.

## Kenapa di-park

User pilih dual track:
1. **OLD TRACK (ykp-erp)**: Postgres 4-DB monorepo, scope HR+Finance+Hermez. Kompleks, 14 residual CRITICAL/HIGH, butuh owner data pack untuk pilot.
2. **NEW TRACK (ykp-hr-v1)**: HR V1 per brief baru, Google Sheets DB, clone app existing, pilot 5-10 karyawan. Lebih ringan, sesuai brief V1.

Brief V1 explicit: "V1 boleh spreadsheet". ykp-erp Postgres = over-engineered untuk V1 pilot. ykp-erp tetap berguna sebagai reference + upgrade path ke Postgres (V2).

## Upgrade path V1 → V2

- ykp-hr-v1 (Sheets) pilot 7 hari → stabil
- Migrasi master + attendance + payroll ke ykp-erp Postgres HR DB (sudah partially built)
- Hermez brief generator (ykp-erp lane Z) bisa reuse begitu HR DB terisi
- Finance lane (ykp-erp lane F) tunggu brief Finance V1 terpisah

## Yang perlu owner data pack sebelum pilot (brief §14)

1. Master Brand & Outlet (5 brand, ≥1 outlet pilot)
2. Master Karyawan pilot (5-10 staff)
3. Aturan Shift per outlet pilot
4. Aturan Payroll (periode, tanggal gajian, tipe gaji, potongan, lembur, bonus, tunjangan, kasbon, BPJS, pajak)
5. Aturan Izin/Cuti
6. Data Absensi Lama 7-30 hari (jika ada)
7. Data Payroll Lama 1-3 periode (jika ada)
8. HR App Existing (link, akun testing, screenshot, bug notes, source code)
9. Telegram bot token + owner chat id (untuk Hermez alerts nanti)