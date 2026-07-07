# YKP HR V1 — Progress

> Per `YKP_ERP_HR_Developer_Brief_V1.txt`. DB: Google Sheets API. Pilot: 1 brand, 1 outlet, 5-10 karyawan, 7 hari.

## Yang sudah dibangun (2026-07-07)

### Scaffold
- `ykp-hr-v1/` Next.js 16 + TS strict + Tailwind
- Google Sheets DB layer (`src/db/sheets.ts`): 17 tab, readTab/appendRows/updateRow/findRow
- Bootstrap script (`scripts/bootstrap-sheets.ts`): idempotent create tabs + seed brands/roles/leave_types/lateness_rules
- Smoke script (`scripts/sheets-smoke.ts`)
- Seed user script (`scripts/seed-user.ts`): default owner/owner123

### Lib
- `format.ts`: formatIdr, formatDateWib, formatTimeWib, todayWib, nowTimestampWib
- `rbac.ts`: 9-role matrix per brief §9, scope filter
- `session.ts`: signed JWS cookie HS256, 24h, sameSite strict, httpOnly, secure prod
- `audit.ts`: logAudit ke audit_log tab
- `http.ts`: JSON envelope, 5xx no leak, handler wrapper
- `repo.ts`: FK validation (assertBrand/Outlet/Employee/Shift), nextSequentialId, error classes
- `ratelimit.ts`: in-memory per (user|ip) limiter

### Sections (9 per brief §6)
1. `/hr` — Overview: KPI cards + 7-day summary
2. `/hr/employees` — Master Karyawan: list + form + CSV import/export
3. `/hr/attendance` — Absensi: form + clock-in/out + history
4. `/hr/roster` — Shift & Roster: assign + today view
5. `/hr/lateness` — Keterlambatan: rekap read-only (auto dari attendance)
6. `/hr/leaves` — Izin/Cuti: form + approval
7. `/hr/payroll` — Payroll: generate + approve + mark paid + payslip
8. `/hr/adjustments` — Bonus/Potongan/Lembur/Kasbon: form + approval
9. `/hr/summary` — HR Daily Summary: regenerate + alert level (green/yellow/red)

### API routes
- `POST /api/auth/login`, `POST /api/auth/logout`
- `GET/POST /api/hr/employees`, `POST /api/hr/employees/import`, `GET /api/hr/employees/export`
- `GET/POST /api/hr/attendance`, `POST /api/hr/attendance/clock-in`, `POST /api/hr/attendance/clock-out`
- `GET/POST /api/hr/roster`
- `GET/POST /api/hr/leaves`, `POST /api/hr/leaves/approve`
- `GET/POST /api/hr/adjustments`, `POST /api/hr/adjustments/approve`
- `POST /api/hr/payroll/generate`, `POST /api/hr/payroll/approve`, `POST /api/hr/payroll/mark-paid`
- `GET /api/hr/payslip/[id]` (text download)
- `POST /api/hr/summary/regenerate`, `GET /api/hr/summary` (Hermez-facing)

### Engine
- `features/hr/lib/payroll.ts`: computePayroll, pro-ration, attendance deduction, overtime 1.5x
- `features/hr/lib/summary.ts`: buildSummary (alert level), buildSummaryText (brief §7 format)
- Vitest: payroll.test.ts, summary.test.ts

### Security
- Middleware: session verification + redirect to /login, public paths allowlisted
- RBAC matrix enforced di setiap route via `can(role, action, resource)`
- 5xx error envelope no stack/PG leak
- Rate limit login (10/min)
- CSV import: 5MB byte limit, 5000 row limit, FK validation per row
- Payslip: owner/HR/finance/self only

## Sisa sebelum pilot

1. Owner data pack (brief §14): brand, outlet, 5-10 karyawan, shift, payroll rules, lateness rules
2. Setup Google Cloud service account + share spreadsheet
3. `npm install` + `sheets:bootstrap` + `sheets:seed-user` + ganti password owner
4. `npm test` green
5. `npm run dev` → smoke manual (PILOT-CHECKLIST.md)
6. 7-day pilot run

## Known limitations V1 (lihat PILOT-CHECKLIST.md)

- Shift swap request belum ada form
- Payroll manual adjustment belum ada UI
- Slip gaji text only (PDF perlu lib)
- Password sha256 (upgrade ke scrypt/bcrypt V1.1)
- Payroll lock setelah PAID belum enforced
- Lat/long radius check belum (mock di notes)
- Telegram attendance bot belum (optional)

## Upgrade path V2

- Migrasi ke ykp-erp Postgres HR DB (sudah partially built, lane H PASS verify)
- Hermez brief generator (ykp-erp lane Z) tinggal connect ke HR DB
- Finance lane (ykp-erp lane F) tunggu brief Finance V1 terpisah