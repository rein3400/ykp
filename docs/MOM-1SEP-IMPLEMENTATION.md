# MOM 1 Sep 2026 — Implementation (branch `mom-1sep-fixes` + VPS develop)

Update 5 Sep: VPS develop ternyata sudah berisi implementasi arris1 yang sejalan
(approve NEEDS_REVISION, employment-contract reminders, finance-notify,
payslip-email brand). Branch ini TIDAK menimpa itu — yang di-deploy ke VPS
hanya delta pelengkap (lihat §1). File generate/contract-route/finance-notify
versi VPS dipertahankan apa adanya.

## 1. Yang dibangun di branch ini

| # | MOM item | Status VPS | File |
|---|---|---|---|
| 1 | Tombol Needs Revision | approve-route arris1 (session) + endpoint HR cross-app `needs-revision` (secret, untuk tombol Finance) | `payroll/needs-revision/route(.test).ts`, `lib/finance-secret.ts`, RBAC `request_revision`, tabel tampilkan alasan, summary hitung NEEDS_REVISION sbg issue |
| 2 | Alur payroll + notify Finance | alur approve VPS dipertahankan (PENDING → APPROVED/NEEDS_REVISION → READY_TO_PAY → PAID+LOCKED); regenerate kembalikan NEEDS_REVISION → PENDING | copy halaman generate, receiver `finance/payroll/hr-notify` (Finance, untuk notify generasi mendatang) |
| 3 | Audit trail mapping | DONE: header audit 12→19 kolom (samakan DDL PG); redaksi PII di GET publik | `db/sheets.ts`, `api/hr/audit/route.ts` |
| 4 | Reminder probation 2 bln + kontrak 14 bln | route + lib arris1 (employment-contract) dipertahankan; cron dipasang §4; middleware PUBLIC ditambah | `middleware.ts` |
| 5 | Slip gaji via email | DUA jalur komplementer: (a) arris1: auto-email saat APPROVE (brand-styled, mocked tanpa SMTP); (b) branch ini: publish manual pasca-PAID `POST /payslip/send` + stamp `email_sent_*` (SMTP env, 503 jelas tanpa kredensial) | `payslip/send/route.ts`, `lib/smtp(.test).ts`, builder `buildPayslipHtml` dipakai GET + send |
| + | Import karyawan MOM | DONE: passthrough email/phone/bank/position/department | `employees/import/route.ts` |

Kolom payroll standar VPS: `needs_revision_reason/at/by`, `finance_notified_at/by`,
`email_sent_at/to/status` (migrasi §3 — WAJIB, route live 500 tanpanya).

## 2. Env (lihat `.env.example` kedua app)

- `FINANCE_NOTIFY_SECRET` (hr + finance, SAMA, ≥32 char) — sudah ada di VPS.
- `CRON_SECRET` — sudah ada di VPS, dipakai juga `contract-reminders`.
- `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` (hr) — BELUM ada; tanpa ini
  `POST /payslip/send` menjawab 503 dan auto-email approve jalan mocked.

## 3. Migrasi + cron (sudah dikerjakan saat deploy 5 Sep)

- `ALTER TABLE hr_payroll` +8 kolom (file `alter-hr-payroll.sql`).
- Cron harian 08:00 WIB (01:00 UTC):
  `0 1 * * * curl -sf -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3002/api/hr/notify/contract-reminders`

## 4. Diketahui, tidak diubah (untuk arris1)

- `finance-notify` pakai index `i+2` di loop massal — benar di Sheets, SALAH di
  Postgres (`__rownum`). Selama prod Postgres, notifikasi massal bisa nulis baris
  yang salah. Saran: samakan dengan pola findRow per ID.
- Approve langsung LOCKED saat APPROVE, dan email terkirim saat approve (bukan
  pasca-PAID seperti MOM Tahap 5). Disengaja oleh tim atau perlu diluruskan —
  keputusan arris1/Bapak. Jalur publish-manual pasca-PAID tersedia sbg alternatif.
- Tombol Finance "Minta Revisi": `docs/FINANCE-NEEDS-REVISION-PATCH.md` (route
  proxy server-side DULU, jangan panggil HR langsung dari browser).

## 5. Verifikasi

- Lokal: hr vitest 160/160 + tsc clean; finance 138/138 + tsc clean.
- VPS: build dua app + restart sekali + probe read-only (§6 runbook awal).
- E2E checklist MOM: import → absensi+roster → generate → approve → Finance →
  Tandai Dibayar → Needs Revision → regenerate → slip → audit.
