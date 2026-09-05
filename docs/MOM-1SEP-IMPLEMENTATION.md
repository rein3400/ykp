# MOM 1 Sep 2026 — Implementation (branch `mom-1sep-fixes`)

Lokal: `D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER`, branch `mom-1sep-fixes`
(dari `predemo-fixes-2026-07-23`). VPS `/home/dev/ykp` branch `develop` lebih baru
(commit 1 Sep: shifts, payroll idempotent, Finance Beban Gaji) — merge dari VPS
dulu sebelum deploy (lihat §6).

## 1. Yang dibangun

| # | MOM item | Status | File |
|---|---|---|---|
| 1 | Tombol Needs Revision | DONE HR-side; tombol Finance = patch doc §5 | `ykp-hr-v1/src/app/api/hr/payroll/needs-revision/route(.test).ts`, `src/lib/finance-secret.ts`, RBAC `request_revision`, TAB_HEADERS payroll +3 kolom, `payroll-table.tsx` tampilkan alasan, `summary/regenerate` hitung NEEDS_REVISION sbg issue |
| 2 | Generate → langsung Ready to Pay + notify Finance | DONE | `generate/route.ts` (upsert idempotent, APPROVED+READY_TO_PAY, notify best-effort), `finance-notify/route.ts` (receiver HR), `ykp-finance-v1/.../payroll/hr-notify/route.ts` (receiver Finance) + middleware PUBLIC dua sisi, copy halaman generate |
| 3 | Audit trail mapping | DONE (code) + aksi Sheets §4 | TAB_HEADERS auditLog 12→19 kolom, `REDACTED_FIELDS` snake_case (PII fix, endpoint ini publik) |
| 4 | Reminder probation 2 bln + kontrak 14 bln | DONE (code) + pasang timer §4 | `src/lib/contract-reminders(.test).ts`, `POST /api/hr/notify/contract-reminders` (CRON_SECRET), middleware PUBLIC |
| 5 | Slip gaji via email | DONE tanpa kredensial; kirim live butuh SMTP §4 | `src/lib/smtp(.test).ts` (stdlib-only), builder slip diekstrak (`buildPayslipHtml`, dipakai GET + send), `POST /api/hr/payslip/send` (wajib PAID, 503 jelas tanpa SMTP) |
| + | Import karyawan MOM | DONE | `import/route.ts` passthrough email/phone/bank/position/department |

State machine payroll sekarang:
`generate → APPROVED + READY_TO_PAY → (Finance: Minta Revisi → NEEDS_REVISION → re-generate) → mark-paid → PAID + LOCKED → kirim slip → (unlock owner bila koreksi)`.
Endpoint `/approve` dipertahankan untuk kompatibilitas, tidak dipakai UI utama.

## 2. Env baru (lihat `.env.example` kedua app)

- `FINANCE_NOTIFY_URL` (HR): default `http://localhost:3003/api/finance/payroll/hr-notify`;
  VPS: `https://oseedigital.tech/api/finance/payroll/hr-notify` (sesuaikan routing Caddy).
- `FINANCE_NOTIFY_SECRET` / alias `HR_NOTIFY_SECRET`: SAMA di kedua app (min 32 char).
- `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`: 1 email pengirim slip.
- `CRON_SECRET`: dipakai juga oleh `contract-reminders`.

## 3. Cron reminder (pasang di VPS, tidak bisa dari sini tanpa SSH)

systemd timer harian 08:00 WIB (server UTC → 01:00 UTC):
`curl -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3002/api/hr/notify/contract-reminders`
Atau crontab: `0 1 * * * curl -sf -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3002/api/hr/notify/contract-reminders`

## 4. Aksi data/infra di VPS (butuh SSH)

1. **Postgres DDL** (tabel `hr_payroll` VPS belum punya kolom revisi):
   `ALTER TABLE hr_payroll ADD COLUMN IF NOT EXISTS revision_reason TEXT DEFAULT '', ADD COLUMN IF NOT EXISTS revision_by TEXT DEFAULT '', ADD COLUMN IF NOT EXISTS revision_at TEXT DEFAULT '';`
   (Kolom audit 8 tambahan SUDAH ada di VPS — tidak perlu.)
2. **Sheets (Vercel/Sheets mode)**: tambah header `revision_reason,revision_by,revision_at`
   di tab `hr_payroll` + 8 header audit di tab `audit_log`, atau `npm run sheets:bootstrap`
   ulang (idempotent) — JANGAN hapus data.
3. **SMTP**: isi kredensial di `.env` hr-v1, restart service.
4. **Restart**: `systemctl restart ykp-hr-v1 ykp-finance-v1` (sekali di akhir, ±10 dtk downtime).

## 5. Tombol Finance "Minta Revisi" (untuk arris1 — halaman payroll Finance hanya ada di VPS)

Lihat `docs/FINANCE-NEEDS-REVISION-PATCH.md` — snippet ±15 baris ke
`ykp-finance-v1/src/app/finance/payroll/payroll-client.tsx`: dialog alasan wajib
→ `POST {HR_APP_URL}/api/hr/payroll/needs-revision` header `x-finance-secret`.
HR-side endpoint + secret sudah live di branch ini.

## 6. Deploy dari branch ini

1. Di VPS: `git fetch origin && git merge origin/mom-1sep-fixes` (resolve konflik
   dengan commit 1 Sep bila ada — area sentuh beda: shifts/finance-overview vs payroll).
2. `npm run build` di `ykp-hr-v1` + `ykp-finance-v1`, verifikasi, restart sekali.
3. E2E checklist MOM: import karyawan → absensi+roster → generate → masuk Finance
   → Tandai Dibayar → validasi HR → kirim slip → Needs Revision → regenerate → audit.

## 7. Verifikasi lokal

- `npx vitest run` ykp-hr-v1: PASS (termasuk 7 needs-revision + 6 contract-reminders + 4 smtp baru)
- `npx tsc --noEmit` ykp-hr-v1 + ykp-finance-v1: clean
