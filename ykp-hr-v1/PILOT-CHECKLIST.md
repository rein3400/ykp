# YKP HR V1 — Pilot Checklist & DoD

> Per brief §13.5 (Testing Minimal) + §16 (Definition of Done).
> Pilot: 1 brand, 1 outlet, 5-10 karyawan, 7 hari.

## Pre-pilot setup

- [ ] Google Cloud service account dibuat, JSON key diunduh
- [ ] Spreadsheet "YKP_HR_V1" dibuat, di-share ke service account (Editor)
- [ ] `.env` terisi: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, YKP_HR_SPREADSHEET_ID, SESSION_SECRET (64 hex)
- [ ] `npm install` sukses
- [ ] `npm run sheets:bootstrap` → semua tab terbuat dengan header
- [ ] `npm run sheets:smoke` → PASS (write+read row)
- [ ] `npm run sheets:seed-user` → user owner terbuat
- [ ] Ganti password owner default (owner123) sebelum pilot
- [ ] `npm test` → vitest payroll + summary green
- [ ] `npm run dev` → http://localhost:3002 jalan
- [ ] Login dengan owner / password → redirect ke /hr

## Master data (owner data pack brief §14)

- [ ] 1 brand pilot (mis. Funkydak BR-001) — sudah seed default
- [ ] 1 outlet pilot (OL-001) dengan lat/long/radius
- [ ] 5-10 karyawan pilot diimpor (CSV atau form)
- [ ] Shift per outlet pilot (master_shift + shift start/end/tolerance)
- [ ] Lateness rule per outlet (tolerance, amount_per_minute, max_penalty)
- [ ] Leave types — sudah seed default 7 jenis
- [ ] Payroll rules (periode, tanggal gajian, tipe gaji) — via master_payroll_rule

## Smoke test (brief §13.5)

- [ ] Tambah karyawan via form → muncul di list
- [ ] Edit karyawan → data berubah
- [ ] Nonaktifkan karyawan (set active_status inactive)
- [ ] Check-in tepat waktu → status PRESENT, late_minutes=0
- [ ] Check-in telat (manual set actual_check_in > scheduled) → status LATE, late_minutes > 0
- [ ] Check-out → actual_check_out terisi
- [ ] Lupa check-out (skip) → di summary muncul incomplete_attendance
- [ ] Absensi di luar radius (mock: catat di notes) → manual correction
- [ ] Koreksi absensi → status MANUAL_CORRECTION + approval
- [ ] Assign shift roster → muncul di roster hari ini
- [ ] Shift swap request (TODO V1.1 — minimal: edit roster notes)
- [ ] Ajukan izin/cuti → status PENDING
- [ ] Approve izin → status APPROVED
- [ ] Input lembur (adjustment OVERTIME) → PENDING
- [ ] Input bonus (adjustment BONUS) → PENDING
- [ ] Input penalty (adjustment PENALTY) → PENDING
- [ ] Input kasbon (adjustment CASH_ADVANCE) → PENDING
- [ ] Approve semua adjustment → APPROVED
- [ ] Generate payroll periode → muncul row per karyawan
- [ ] Cocokkan 1 payroll dengan hitungan manual (brief contoh Ayu Rp4.500.000)
- [ ] Manual adjustment payroll (TODO V1.1)
- [ ] Approve payroll → APPROVED, payment_status READY_TO_PAY
- [ ] Reject payroll (kasus uji) → REJECTED
- [ ] Generate slip gaji (download .txt) → konten benar
- [ ] Mark payroll as PAID → payment_status PAID, payment_date terisi
- [ ] Filter brand/outlet/periode di overview
- [ ] Generate hr_daily_summary → muncul di summary page
- [ ] Export employees CSV → file terdownload
- [ ] Import employees CSV → rows bertambah

## 7-day pilot

- [ ] Hari 1-7: absensi check-in/out berjalan untuk 5-10 karyawan
- [ ] Setiap hari: regenerate summary, verifikasi KPI cocok manual
- [ ] Akhir periode: generate payroll, review, approve, mark paid
- [ ] Slip gaji tergenerate untuk semua karyawan pilot
- [ ] Audit log terisi di setiap aksi (cek tab audit_log)

## Security checklist (brief §18)

- [ ] API key/service account JSON tidak di-commit (.gitignore)
- [ ] Password di-hash (sha256 — TODO V1.1: bcrypt/scrypt)
- [ ] Akun testing terpisah dari akun pilot
- [ ] Slip gaji hanya akses role terkait (middleware + RBAC)
- [ ] Audit log perubahan gaji pokok + rekening bank (TODO V1.1: approval flow)
- [ ] Backup spreadsheet manual mingguan (Google Sheets version history)
- [ ] Data pribadi tidak dikirim ke grup Telegram (Hermez baca summary agregat only)
- [ ] Payroll final locked (tidak bisa edit setelah PAID) — TODO V1.1

## DoD (brief §16)

- [x] HR App pakai database YKP (Google Sheets)
- [x] Data dummy hilang (no faker seed di V1)
- [ ] Master brand/outlet/karyawan/shift masuk (perlu owner data pack)
- [x] Absensi masuk/pulang berjalan
- [x] Keterlambatan dihitung (tolerance + payable)
- [x] Koreksi absensi + approval (MANUAL_CORRECTION status)
- [x] Shift roster jalan (swap TODO V1.1)
- [x] Izin/cuti jalan + approval
- [x] Bonus/potongan/lembur/kasbon + approval
- [ ] Payroll simulation cocok manual (verifikasi dengan data pack)
- [x] Payroll approval jalan
- [x] Slip gaji bisa dibuat (text, PDF TODO V1.1)
- [x] Filter brand/outlet/periode jalan (overview)
- [x] HR daily summary tersedia
- [ ] Pilot 5-10 karyawan 7 hari (perlu deploy + owner data)
- [ ] HR admin bisa operasikan sendiri (perlu training)
- [x] Data payroll & rekening protected (RBAC)

## Out of scope V1 (brief §17) — jangan kerjakan

Bank API, VA payroll, auto transfer, full BPJS, full tax, biometric, face recognition,
native mobile, PostgreSQL migration, Hermez full integration, AI scoring, recruitment, LMS.

## Pre-launch code fixes (2026-07-09)

Sebelum pilot, verifikasi perubahan kode hasil audit blocker:

- [x] `findRow` match by `keyCol`, not hardcoded col 0 (`src/db/sheets.ts`)
- [x] `updateRow` / bootstrap header row correct untuk tab >26 kolom (`columnLetter()`)
- [x] `auditId` unik antar restart (crypto random)
- [x] `nextSequentialId` race-safe (timestamp + random suffix)
- [x] `hermes_alert_log` tab + writer per brief §11 (`src/lib/hermez-alerts.ts`)
- [x] `summary/regenerate` load leaves, `staff_leave` populated, `staff_absent` = ABSENT status
- [x] `attendance/clock-in` deteksi telat vs shift + tolerance
- [x] 15 route `can(session.role as any, ...)` diganti `as Role`
- [x] Type-check `npx tsc --noEmit` clean
- [x] Unit tests 28/28 pass
- [ ] Full `npm run build` — blocked segfault di Next.js 16/Turbopack (pre-existing environment issue), disetujui owner untuk diurus di cloud deploy

## Known limitations V1 (follow-up V1.1)

- Shift swap request belum ada form (edit roster manual)
- Payroll manual adjustment belum ada UI (re-generate periode = reset)
- Slip gaji text only (PDF perlu lib)
- Password sha256 (upgrade ke scrypt/bcrypt)
- Payroll lock setelah PAID belum di-enforce di API
- Approval bank account change belum ada flow khusus
- Latitude/longitude radius check belum diimplement (mock di notes)
- Telegram attendance bot belum (brief optional V1)