# YKP HR V1

HR Module V1 per `YKP_ERP_HR_Developer_Brief_V1.txt`.

## Stack

- **Next.js 16** (app router) + TypeScript strict
- **Google Sheets API** as the source-of-truth database (per brief V1 — spreadsheet allowed)
- Service-account auth, no Clerk
- 9-role RBAC, audit log, simple session cookie
- Tailwind + shadcn-style UI primitives (minimal)

## Why Google Sheets for V1

Brief V1 explicit: "Database awal: Untuk V1 boleh menggunakan Google Sheet / Spreadsheet Database".
Owner can edit manually, no DB server, audit log sheet, FK-validation in app layer.
Pilot: 1 brand, 1 outlet, 5-10 staff, 7 days. Sheets API quota (60 write/min) is sufficient.

## Quick start

```bash
# 1. Setup Google Cloud service account + share spreadsheet
#    see docs/GOOGLE-SHEETS-SETUP.md

cp .env.example .env
# fill GOOGLE_SERVICE_ACCOUNT_* and YKP_HR_SPREADSHEET_ID

npm install
npm run sheets:bootstrap     # creates all sheets with header row + seed masters
npm run dev                  # http://localhost:3002
```

## Layout

```
src/
  app/                       # Next.js pages (9 sections per brief)
  features/hr/
    components/              # tables, forms, KPI cards
    api/                     # client queries (TanStack)
    lib/                     # sheet repo, formulas, validation
  lib/                       # session, RBAC, audit, format
  db/
    sheets.ts                # googleapis client + tab definitions
scripts/
  bootstrap-sheets.ts        # idempotent: create all tabs with headers
  sheets-smoke.ts            # write+read roundtrip
```

## Sections (per brief §6)

1. `/hr` — HR Overview (KPI cards, filter brand/outlet/period)
2. `/hr/employees` — Master Karyawan
3. `/hr/attendance` — Absensi
4. `/hr/roster` — Shift & Roster
5. `/hr/lateness` — Keterlambatan
6. `/hr/leaves` — Izin/Cuti/Sakit
7. `/hr/payroll` — Payroll
8. `/hr/adjustments` — Bonus/Potongan/Lembur/Kasbon
9. `/hr/summary` — HR Daily Summary (Hermez consumer)

## Definition of Done (per brief §16)

- HR App pakai database YKP (Sheets) ✓
- Data dummy hilang ✓
- Master brand/outlet/karyawan/shift masuk ✓
- Absensi masuk/pulang jalan ✓
- Keterlambatan dihitung benar ✓
- Koreksi absensi + approval jalan
- Shift roster + swap jalan
- Izin/cuti jalan
- Bonus/potongan/lembur/kasbon + approval
- Payroll simulation cocok manual
- Payroll approval jalan
- Slip gaji PDF
- Filter brand/outlet/period jalan
- HR daily summary tersedia (Hermez)
- Pilot 5-10 karyawan 7 hari
- HR admin bisa pakai sendiri
- Data payroll & rekening protected

## Out of Scope (V1, per brief §17)

Bank API, auto transfer, full BPJS, full tax, biometric, face recognition,
native mobile, PostgreSQL migration (this is V2), Hermez full integration.
