# YKP HERMEZ AI COMMAND CENTER — Progress

> Single source of truth untuk semua track. Update tiap ada perubahan.
> Last update: 2026-07-07

## Status sekarang

| Track | Status | Lokasi |
|---|---|---|
| A — ICT Trading Orchestrator | deprioritized | `orchestrator/` |
| B-OLD — ykp-erp (HR+Finance+Hermez, Postgres) | **parked** | `ykp-erp/` |
| B-NEW — HR V1 (Google Sheets, brief V1) | **siap setup + pilot** | `ykp-hr-v1/` |
| Infra — Cloudflare Tunnel, MT5 bridge, prod secrets | selesai untuk orchestrator | `orchestrator/`, `mt5-bridge-service/` |

---

## Track A — ICT Trading Orchestrator (deprioritized)

Tidak disentuh dalam eksekusi terakhir. Fokus user pindah ke Track B per brief baru.
Existing state: orchestrator jalan paper-trade, dashboard ada, MT5 mock dipakai.

---

## Track B-OLD — ykp-erp (parked)

Path: `D:\Users\stefa\Project\YKP HERMEZ AI COMMAND CENTER\ykp-erp\`

### Deliverables
- Monorepo: `apps/hr`, `apps/finance`, `apps/hermez`, `packages/{schema,engine,auth,ui,config,format}`
- 4-DB Postgres: ykp_master, ykp_hr, ykp_finance, ykp_hermez (separate, cross-DB FK validated in app)
- Engine: payroll, attendance, hr-summary, fin-summary, moka-importer, approval, hermez-brief, triggers, telegram, cron, audit, id-gen, lookup
- Auth: signed JWS HS256 24h strict SameSite + RBAC matrix 9-role
- Currency integer IDR, Asia/Jakarta, integer stable IDs (BR-001, OL-001, EMP-NNNNN, etc)
- Hermez no-write-back (read summary only, write only hermez_daily_brief + hermez_alert_log + hermez_config)

### Verify result terakhir (re-verify v4, 2026-07-07)
- H (HR): **PASS**
- F (Finance): **FAIL** — 5 CRITICAL (POS/expense/supplier/closing-cash/petty-cash seq allocation global-per-date not per-outlet)
- Z (Hermez): **FAIL** — sentToOwner reset on regen, hermezAlertId format deviate
- Security: **FAIL** — residual
- Integration: **FAIL** — residual
- Total: 14 CRITICAL/HIGH, 63 MEDIUM/LOW

### Kenapa di-park
- Stuck di fix loop (67 → 31 → 9 → 14 CRITICAL/HIGH, tidak converge)
- Brief V1 baru minta scope lebih ringan (HR only, spreadsheet OK)
- User pilih dual track: ykp-erp lanjut dokumentasi saja, tidak ada fix loop lagi

### Dokumen
- `ykp-erp/YKP_ERP_V1_FINAL.md` — final state, known residuals, upgrade path
- `ykp-erp/PROGRESS.md` — execution progress (existing)

### Upgrade path ke V2
- HR lane PASS bisa di-reuse sebagai Postgres HR DB target
- Migrasi ykp-hr-v1 (Sheets) → ykp-erp HR Postgres setelah pilot stabil
- Finance + Hermez lanes tunggu brief V1 masing-masing

---

## Track B-NEW — HR V1 (Google Sheets)

Path: `D:\Users\stefa\Project\YKP HERMEZ AI COMMAND CENTER\ykp-hr-v1\`

### Brief
`YKP_ERP_HR_Developer_Brief_V1.txt` — clone existing HR app, swap DB ke YKP, V1 boleh spreadsheet, pilot 5-10 karyawan 7 hari.

### Stack
- Next.js 16 + TS strict + Tailwind
- TanStack Query (client state)
- googleapis (Sheets API, service-account JWT auth, no Clerk)
- Vitest (engine unit tests)

### DB: Google Sheets
- 17 tabs (master + transactional + summary + users + audit)
- Service account JSON key, share spreadsheet as Editor
- FK validation di app layer (`src/lib/repo.ts`)
- ID generation sequential per prefix

### Yang sudah dibangun

**Scaffold:**
- `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts`, `middleware.ts`
- `.env.example`, `.gitignore`, `README.md`, `docs/GOOGLE-SHEETS-SETUP.md`, `PILOT-CHECKLIST.md`, `PROGRESS.md`

**Lib (`src/lib/`):**
- `format.ts` — formatIdr, formatDateWib, formatTimeWib, todayWib, nowTimestampWib (Asia/Jakarta)
- `rbac.ts` — 9-role matrix (owner, super_admin, hr_admin, finance_admin, brand_manager, outlet_manager, supervisor, employee, viewer) + scopeFilter
- `session.ts` — signed JWS HS256 cookie, 24h, sameSite strict, httpOnly, secure prod
- `audit.ts` — logAudit ke audit_log tab (idempotent, never break main op)
- `http.ts` — JSON envelope ok/list/badRequest/missingRef/forbidden/unauthorized/conflict/notFound/serverError + handler wrapper (5xx never leak stack)
- `repo.ts` — assertBrand/assertOutlet/assertEmployee/assertShift + nextSequentialId + error classes
- `ratelimit.ts` — in-memory per (user|ip) limiter

**DB (`src/db/`):**
- `sheets.ts` — googleapis JWT client + TAB/TAB_HEADERS + readTab/appendRows/updateRow/findRow

**Engine (`src/features/hr/lib/`):**
- `payroll.ts` — computePayroll (Gross = Basic + OT + Bonus + Allowance; Net = Gross − AttDed − Penalty − CashAdvance − BPJS − Tax − Other), pro-ration join date mid-period, overtime 1.5x, attendance deduction
- `summary.ts` — buildSummary (alert level green/yellow/red), buildSummaryText (brief §7 format)

**Sections (9 per brief §6, `src/app/hr/`):**
1. `/hr` — Overview: KPI cards + 7-day summary (tot_staff, present, late, absent, incomplete, shift shortage, payroll issues)
2. `/hr/employees` — Master Karyawan: list + form + CSV import/export
3. `/hr/attendance` — Absensi: form + clock-in/out + history + status auto (PRESENT/LATE/ABSENT/LEAVE/SICK/INCOMPLETE/MANUAL_CORRECTION)
4. `/hr/roster` — Shift & Roster: assign + today view
5. `/hr/lateness` — Keterlambatan: rekap read-only (auto populate dari attendance)
6. `/hr/leaves` — Izin/Cuti: form + approval (PENDING/APPROVED/REJECTED)
7. `/hr/payroll` — Payroll: generate + approve + mark paid + payslip text download
8. `/hr/adjustments` — Bonus/Potongan/Lembur/Kasbon: form + approval
9. `/hr/summary` — HR Daily Summary: regenerate + alert level + brief text

**API routes (`src/app/api/hr/`):**
- `POST /api/auth/login`, `POST /api/auth/logout`
- `GET/POST /api/hr/employees`, `POST /api/hr/employees/import` (5MB + 5000 row limit, FK per row), `GET /api/hr/employees/export`
- `GET/POST /api/hr/attendance`, `POST /api/hr/attendance/clock-in`, `POST /api/hr/attendance/clock-out`
- `GET/POST /api/hr/roster`
- `GET/POST /api/hr/leaves`, `POST /api/hr/leaves/approve`
- `GET/POST /api/hr/adjustments`, `POST /api/hr/adjustments/approve`
- `POST /api/hr/payroll/generate`, `POST /api/hr/payroll/approve`, `POST /api/hr/payroll/mark-paid`
- `GET /api/hr/payslip/[id]` (text download, owner/HR/finance/self only)
- `POST /api/hr/summary/regenerate`, `GET /api/hr/summary` (Hermez-facing, no session)

**Scripts (`scripts/`):**
- `bootstrap-sheets.ts` — idempotent create tabs + seed brands/roles/leave_types/lateness_rules
- `seed-user.ts` — default owner/owner123 (CHANGE before pilot)
- `sheets-smoke.ts` — write+read roundtrip

**Tests (vitest):**
- `payroll.test.ts` — 4 tests: full month monthly, mid-period pro-ration, attendance deduction, overtime 1.5x
- `summary.test.ts` — 3 tests: green baseline, yellow on late>2, red on shift shortage
- **Result: 7/7 PASS** ✓

**Install + verify terakhir:**
- `npm install` — 195 packages, 11 vulnerabilities (8 mod, 1 high, 2 critical di Next.js 16 — `npm audit fix --force` recommended)
- `npx vitest run` — Test Files 2 passed, Tests 7 passed, Duration 1.73s

### Sisa sebelum pilot (perlu owner)

1. **Google Cloud service account** — IAM → service account → JSON key → share spreadsheet as Editor
2. **Isi `.env`:**
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL=<svc email>`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="<JSON private_key dengan \\n literal>"`
   - `YKP_HR_SPREADSHEET_ID=<id dari URL spreadsheet>`
   - `SESSION_SECRET=<64 hex>`
3. **Owner data pack** (brief §14): brand, outlet pilot (lat/long/radius), 5-10 karyawan (CSV), shift rules per outlet, payroll rules, lateness rules
4. **Run:**
   ```
   npm install                                # sudah done
   npx vitest run                             # 7/7 PASS
   npm run sheets:bootstrap                   # create tabs + seed
   npm run sheets:smoke                       # verify roundtrip
   npm run sheets:seed-user                   # create owner
   # GANTI password owner default
   npm run dev                                # http://localhost:3002
   ```
5. **Smoke manual** per `PILOT-CHECKLIST.md` (brief §13.5)
6. **7-day pilot** dengan 5-10 karyawan

### V1 limitations (V1.1 follow-up)
- Shift swap request belum ada form (edit manual)
- Payroll manual adjustment belum ada UI (re-generate = reset)
- Slip gaji text only (PDF perlu lib)
- Password sha256 (upgrade ke scrypt/bcrypt)
- Payroll lock setelah PAID belum enforced
- Lat/long radius check belum (mock di notes)
- Telegram attendance bot belum (optional V1)

### Upgrade path V2
- Migrate HR data → ykp-erp Postgres HR DB (lane H PASS)
- Connect ykp-erp Hermez lane Z ke HR Postgres
- Tambah Finance lane dari brief V1 terpisah (kalau ada)

---

## Track Infra — sudah selesai (untuk orchestrator)

- B1 prod secrets generated
- B2 Windows tooling provisioned
- B3 MT5 bridge service installed
- B5 prod containers deployed
- B6 PROGRESS.md written
- C1-C4 (Cloudflare Tunnel webhook, MT5 real account, rotate secrets, E2E smoke) — pending, Track A untouched
- B4 Cloudflare Tunnel service — pending

---

## Apa yang harus dilakukan selanjutnya (urutan)

1. **Owner setup Google Cloud + spreadsheet + .env** untuk ykp-hr-v1
2. **Owner sediakan data pack** (brief §14)
3. **`npm run sheets:bootstrap` + smoke + seed user + ganti password**
4. **`npm run dev` → smoke manual PILOT-CHECKLIST**
5. **7-day pilot 5-10 karyawan**
6. **Verifikasi DoD** (brief §16)
7. (Optional V2) Migrate ke Postgres

---

## File referensi

- `YKP_ERP_HR_Developer_Brief_V1.txt` — brief V1 (driver)
- `ykp-hr-v1/README.md` — quickstart
- `ykp-hr-v1/PILOT-CHECKLIST.md` — step-by-step pilot guide
- `ykp-hr-v1/docs/GOOGLE-SHEETS-SETUP.md` — GCP setup
- `ykp-erp/YKP_ERP_V1_FINAL.md` — old track parked state