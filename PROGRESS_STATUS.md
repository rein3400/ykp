# Progress Status vs Goal Brief

> Snapshot: 2026-07-15 (detail-close pass)
> Sumber: 3 brief (Excel F1-F5, List Revisi 31, Warehouse Inventory V1) + `PROGRESS.md` + codebase
> **Deep verify:** `VERIFICATION_REPORT.md` (2026-07-12)
> **ERP Revisi:** 5-wave (2026-07-14) + residual close (item 4 cross-link, 11 swap, 12 doctor letter, 13 adj attachment, 17 employee detail, 18 correction, 26 user UI)
> **Warehouse Inventory V1:** full upgrade + Excel dashboard KPI 1:1 + Hermez wire + opening balance; Sheets live bootstrap; 40 unit tests

---

## Ringkasan Cepat

| Track | Infra | Data Asli | Pilot 7 hari | Verify Manual | DoD terpenuhi? |
|---|---|---|---|---|---|
| A — Orchestrator (ICT) | ✅ | ❌ KB kosong | N/A | unit 41/41 ✅ (hard-gates/scoring/risk/session aligned ICT strategy 2026-07-12); live trade N/A | ❌ paused — strategy engine wired, KB+news provider empty |
| B-OLD — ykp-erp | ✅ | ❌ mock (diperkaya 2026-07-14) | ❌ | API OK; tsc clean; 31 item revisi ERP addressed | ❌ tunggu data pack + db:migrate + deploy |
| B-NEW — ykp-hr-v1 | ✅ | ❌ mock | ❌ | most pages 200; payroll lock + unlock + payslip HTML + summary 12 KPI; tsc clean | ❌ tunggu data pack + rotate password |
| Warehouse V1 | ✅ code | ❌ mock | ❌ | unit 40/40 ✅; tsc clean; 37 tabs + 18 API + 18 pages; ledger/purchase/expiry/alerts wired | ❌ tunggu GCP Sheets + data pack + pilot 10–20 item |
| Investor V1 | ✅ code | ❌ mock | ❌ | pages scaffold 3006; cap table + dashboard | ❌ tunggu data pack + deploy |
| C — Operational | ❌ | N/A | N/A | N/A | N/A out of Phase 1 |
| D — Marketing | ❌ | N/A | N/A | N/A | N/A out of Phase 1 |
| Hermez AI Layer | ✅ | ❌ mock | N/A | brief/alerts/run API OK; action tracker + telegram log + env tags + threshold config real DB done | ❌ tunggu summary verified |

**Blocker utama: owner data pack belum diterima.** Infra hampir semua track sudah live; DoD Phase 1 tidak bisa ditutup tanpa data asli YKP.

**Production gate (verify 2026-07-12): FAIL** — mock data, default `owner/owner123` live, P0/P1 bugs terbuka. Detail: `VERIFICATION_REPORT.md`.

---

## Track A — ICT Trading Orchestrator (`orchestrator/`)

**Status:** deprioritized, infra-only work paused
**Brief:** `HERMES_AI_SRI_ICT_Developer_Brief.txt`
**Port:** API `3001`, dashboard `/dashboard`

### Goal brief
1. AI trading berbasis ICT yang membaca market otomatis.
2. Knowledge base pribadi (Sri ICT).
3. Sinyal ke Telegram.
4. Risk Manager.
5. Siap berkembang menuju auto execution.
6. Hermes mampu: HTF bias → liquidity → setup score → sinyal → risiko → jurnal → otomasi sesuai SOP Sri ICT.

**Roadmap goal:**
- Phase 1 — Knowledge Base + RAG + Telegram Signal
- Phase 2 — Semi Auto + EA Risk Manager + Manual Approval
- Phase 3 — Full Auto Execution + Journal + Audit + Dashboard

### ✅ Sudah jadi
- 25 modul di `src/modules/`: trading-engine, scoring, session-filter, news-filter, risk-manager, approval, trade-executor, trade-auditor, telegram-bot, owner-bot, hr-bot, finance-bot, sop-bot, knowledge-ingest, knowledge-search, mt5-bridge, mt5-http-bridge, agents (5 agent), journal, memory, screenshot, erp, auth, finance-bot.
- Fastify 5 + Drizzle + BullMQ + Qdrant wired.
- Dashboard statis `dashboard/index.html`.
- `.env`, `.env.prod`, `docker-compose.yml` (postgres + redis + ollama profile).
- Vitest: scoring, risk, session, mt5-mock, approval, circuit-breaker, metrics, knowledge-search.
- NSSM services: `YKPMT5Bridge` + `YKPCloudflared` deployed.

### ⏸️ Belum / blocked
- MT5 bridge owner decision — Windows-only SDK, butuh owner setup MT5 account.
- Live trading loop belum diaktifkan — webhook → execution ke MT5 belum live.
- Knowledge base kosong — pipeline YouTube → transcript → vector DB belum ada konten Sri ICT.
- Telegram bot signal — `@justatestermaybot` ada, approval flow Phase 2 belum aktif.

### Gap vs goal
Phase 1 (KB + RAG + Telegram) **infra siap**. **2026-07-12 strategy alignment shipped:**
- Scoring weights = strategy §4 (HTF25/sweep15/MSS15/IFVG15/RR15/session10/news5)
- `evaluateHardGates` wired in `processAlert` (before score)
- Risk gates: min RR 3, max open 3, daily loss 5%, score&lt;90 → max 1% risk
- Kill Zone windows WIB (LDN 09–12, NY 14–17); Asia non-tradeable
- News filter fail-closed for stub **and** unimplemented providers
- Optional webhook `sl`/`tp`; PD_* signals update state (not yet in pgEnum)
- Unit tests **41/41** pass; `tsc --noEmit` clean
- Seeded `Hermes_Knowledge/{SOP Sri ICT,Risk Management,Kill Zone}` from strategy doc

Masih kurang: real news provider + `news_events` ingest, OHLC structure detection (masih flag dari TV), KB embed/index ke Qdrant, live Telegram signal smoke, ICT Mentor RAG grounding. Phase 2/3 execution path ada tapi belum live.

---

## Track B-OLD — ykp-erp monorepo

**Status:** un-parked 2026-07-09, 14 residual CRITICAL/HIGH fixed, deployed Railway
**Brief:** `YKP_ERP_HR_Developer_Brief_V1.txt`, `YKP_ERP_Finance_Developer_Brief_V1.txt`, `YKP_ERP_Roadmap_Phase1_Migration_Brief.pdf`
**Port:** HR `3002`, Finance `3003`, Hermez `3004`
**Live:**
- ykp-erp-finance-production.up.railway.app
- ykp-erp-hermez-production.up.railway.app
- ykp-erp-hr-production.up.railway.app

### Goal brief
- Clone/lanjutkan HR + Finance app existing → ganti DB ke YKP → isi master data → migrasi → test → pilot 1 brand/outlet.
- Finance: POS revenue, supplier costing, petty cash, expense, unpaid bills, cashflow, profit, finance daily summary.
- HR: master karyawan, absensi, shift/roster, keterlambatan, izin/cuti, payroll, bonus/potongan, slip gaji, HR daily summary.
- Hermez: baca summary → daily brief + alert ke owner.

### ✅ Sudah jadi
- Monorepo 4-DB Postgres: master / hr / finance / hermez schemas migrated.
- `packages/engine`: payroll, attendance, hr-summary, fin-summary, moka-importer, approval, hermez-brief, 7 triggers, cron, telegram, audit, id-gen, lookup.
- `packages/auth`: HS256 JWS 24h + RBAC 8 role + outlet scope helper.
- `packages/format`, `packages/config`, `packages/ui`, `packages/schema`.
- `apps/hr`, `apps/finance` (16 routes + 9 pages), `apps/hermez` (brief/alerts/config/run/telegram-test + brief-cron worker).
- **14 residual fix trail selesai:**
  - F1–F6 Finance (seq counter, UTF-8 byte cap, date projection, parseIdr, notInArray)
  - Z7–Z8 Hermez (alert id, re-notify guard)
  - Sec 9 / 10 / 14 (outlet scope, Telegram detail, rate limit + CSP + CORS)
- Mock data ~5,000 records seeded:
  - 5 brand, 15 outlet, 50 employee
  - 1,355 attendance, 450 POS, 450 expense, 237 supplier_cost, 450 petty_cash
  - 500 daily summaries, 50 payroll, 90 alert, 30 daily briefs, 350 audit log
- Pilot seed 7-day transactional (`seed-pilot.ts`).
- Verify pass v5: H PASS, F PASS, Z PASS, Security PASS, Integration PASS.
- Deployed Railway, all 200 OK.

### ⏸️ Belum / blocked
- Login UI ykp-erp apps — belum ada form login (test via cookie injection).
- Owner data pack belum diterima — master brand/outlet/employee/supplier asli YKP belum masuk (sekarang mock).
- Supabase + Vercel migration — planned, belum execute (sekarang Railway).
- Real pilot 7 hari — belum jalan, tunggu data pack.
- Payroll belum diverifikasi vs hitungan manual owner.
- Finance angka belum divalidasi vs Moka export asli.

### Gap vs goal
HR + Finance Foundation **infra 100% done + deployed**. DoD Phase 1 belum terpenuhi karena:
1. Data masih mock, bukan YKP asli.
2. Payroll belum verify vs hitungan manual.
3. Pilot 7 hari belum mulai.
4. Admin belum training.

---

## Track B-NEW — ykp-hr-v1 (Google Sheets)

**Status:** active, pilot ready, tunggu owner data pack
**Brief:** `YKP_ERP_HR_Developer_Brief_V1.txt`, `BRIEF_GAP_ANALYSIS.md`, `PILOT-CHECKLIST.md`
**Port:** `3002` (collision dengan ykp-erp/hr — run one at a time)
**Live:** ykp-hr-v1-standalone-production.up.railway.app

### Goal brief
HR Module V1: master karyawan, absensi, shift/roster, keterlambatan, izin/cuti, payroll, bonus/potongan, slip gaji, HR daily summary, audit log. Pilot 5–10 karyawan, 1 brand/outlet, 7 hari.

### ✅ Sudah jadi
- Next.js 16 + Google Sheets API, 17 tabs bootstrap.
- Seed: 5 brand, 9 role, 7 leave type, 10 outlet, 9 shift, 8 employee, 1 user.
- 9 section HR per brief §6: Overview, Karyawan, Absensi, Shift/Roster, Keterlambatan, Izin/Cuti, Payroll, Bonus/Potongan, Slip Gaji.
- RBAC 9 role + session HS256.
- `GET /api/hr/summary?date=` public untuk Hermez read.
- Audit log best-effort.
- Pre-launch code fixes done:
  - `findRow` match by keyCol
  - `columnLetter()` untuk tab >26 kolom
  - `auditId` random, `nextSequentialId` race-safe
  - `hermes_alert_log` writer
  - clock-in telat detection
  - 15 route type fix
  - `tsc --noEmit` clean, 28/28 unit test pass
- Deployed Railway, 200 OK.

### ⏸️ Belum / blocked

**Owner-side (blocker eksternal):**
- GCP service account + spreadsheet share.
- 5–10 karyawan pilot, shift rule, payroll rule, lateness rule.
- Ganti password owner default (`owner123`) sebelum pilot.

**Code-side (bisa dikerjakan sekarang):**
- Phase 4 approval UI — **verify 2026-07-12 update:**
  - leaves approve/reject → ✅ **wired** (Setujui/Tolak per row)
  - adjustments approve/reject → ❌ UI missing (API `/api/hr/adjustments/approve` ada)
  - payroll approve → ❌ UI missing (API `/api/hr/payroll/approve` ada)
  - payroll mark-paid → ❌ UI missing (API `/api/hr/payroll/mark-paid` ada)
- Phase 5–6:
  - Sidebar logout button → ✅ **ada** (verify)
  - HR Overview filters (brand/outlet/period/role/status)
  - Employee edit/deactivate row actions
- **P0/P1 dari deep verify:**
  - `/hr/lateness` intermittent SSR 500
  - clock-in double-submit resilience
  - rotate default password `owner123` sebelum pilot
- PDF payslip — sekarang text only.
- GPS radius validation — column ada, validator belum.
- Telegram absensi bot, QR code, photo upload.
- Shift swap UI, reopen payroll UI, bank transfer export.
- 11 alert rules — partial, baru sebagian.
- Full `npm run build` — blocked segfault Next.js 16/Turbopack (pre-existing env, disetujui diurus di cloud).
- Pilot 7 hari belum mulai.
- Employee dropdown empty (leaves/adjustments) → ✅ **fixed** (verify: 8 karyawan).

### DoD checklist (brief §16)

| Item | Status |
|---|---|
| HR App pakai database YKP (Google Sheets) | ✅ |
| Data dummy hilang | ✅ |
| Master brand/outlet/karyawan/shift masuk | ❌ perlu owner data pack |
| Absensi masuk/pulang | ✅ |
| Keterlambatan dihitung | ✅ |
| Koreksi absensi + approval | ✅ |
| Shift roster | ✅ (swap TODO V1.1) |
| Izin/cuti + approval | ✅ |
| Bonus/potongan/lembur/kasbon + approval | ✅ |
| Payroll simulation cocok manual | ❌ verifikasi dengan data pack |
| Payroll approval | ✅ |
| Slip gaji | ✅ text (PDF TODO V1.1) |
| Filter brand/outlet/periode | ✅ overview |
| HR daily summary | ✅ |
| Pilot 5–10 karyawan 7 hari | ❌ |
| HR admin bisa operasikan sendiri | ❌ training |
| Data payroll & rekening protected | ✅ RBAC |

### Gap vs goal
Backend + ~80% UI done, deployed live. DoD belum terpenuhi: pilot belum mulai, master data asli belum masuk, payroll belum verify manual, approval UI masih 4 button kurang, beberapa fitur brief V1 (PDF/GPS/Telegram/QR) deferred ke V1.1.

---

## Track B-NEW — Warehouse + Investor V1

**Status:** active, pilot ready (code), tunggu GCP service account + spreadsheet
**Brief:** Warehouse + Investor module V1 (Google Sheets)
**Port:** Warehouse `3005`, Investor `3006`
**Stack:** Next.js 16 + Google Sheets API

### Goal brief
Warehouse: master item, stock in/out, F1-F5 forms, closing reconciliation, warehouse dashboard, daily summary. Investor: portfolio, capital, dividend, returns, investor dashboard. Hermez read-only summary endpoints.

### ✅ Sudah jadi
- Next.js 16 + Google Sheets API, 11 warehouse tabs + 9 investor tabs bootstrap.
- 10 master items seeded.
- Warehouse: F1 (penerimaan barang), F2 (kartu stok), F3 (bon pemakaian dapur), F4 (waste/kerusakan), F5 (closing stock opname harian), warehouse dashboard, daily summary.
- Investor: dashboard, portfolio, capital, dividend, returns.
- RBAC: warehouse (owner/manager/warehouse_pic/staff), investor (owner/investor).
- Auth HS256 cookie + audit log best-effort.
- `tsc --noEmit` clean (warehouse + investor).
- Hermez summary endpoints public (read-only).

### ⏸️ Belum / blocked
- GCP service account + spreadsheet share (blocker eksternal).
- Master item asli YKP belum masuk (sekarang 10 seed).
- Pilot 7 hari belum mulai.
- Admin belum training.

### Gap vs goal
Code 100% done, deployed ready. DoD Phase 1 belum terpenuhi: data masih seed, bukan YKP asli, pilot belum mulai.

---

## ERP Revisi 5-Wave (2026-07-14)

**Sumber:** `YKP_ERP_List_Revisi_Developer.txt` (31 item revisi Finance, HR, Hermez, Security, UX)
**Eksekusi:** 14-agent workflow, 1.25M token, 363 tool use, ~24 menit
**Typecheck:** ykp-erp ✅ clean · ykp-hr-v1 ✅ clean

### Wave 1 — P0: Profit Fix + Threshold + Seed
- **Profit label**: `net_profit_estimate` → `estimated_operating_result` di engine + dashboard + analytics + summary
- **Threshold config**: stub → real DB-backed di Hermez Config (label/unit/severity/deskripsi ID)
- **Seed enrichment**: +5 employee, 14 hari attendance, 30 hari POS, 10 supplier invoice, 15 expense, 15 petty cash, 1 payroll sim, 3 leave request

### Wave 2 — Finance Gaps
- **POS settlement validation**: `settlementDifference` di `fin-summary.ts` + schema, alert `settlement_mismatch`
- **Expense filters**: date range, brand, outlet, category, approval status filter bar
- **Analytics enrichment**: period selector (7d/month/quarter), brand/outlet filter, payment method breakdown, supplier aging buckets, supplier cost KPI

### Wave 3 — HR Gaps (hr-v1)
- **Payroll lock**: `locked_status` (UNLOCKED/LOCKED) + unlock route dengan reason + approval + audit
- **Payslip**: text → HTML print-friendly (Print→Save as PDF)
- **HR summary**: 12 KPI lengkap (scheduled_staff, incomplete_attendance, leave_count, overtime_hours, shift_shortage, payroll_issue_count, dll)

### Wave 4 — Hermez + Security
- **Action Tracker**: schema `hermez_action_tracker` + API CRUD + page `/hermez/actions` (OPEN→IN_PROGRESS→DONE→CANCELLED)
- **Telegram delivery log**: `hermez_telegram_log` table + logging di `telegram.ts` + `brief-cron.ts`
- **Environment tags**: `environment` column di alerts + briefs (DEMO/TESTING/PRODUCTION)
- **Audit coverage**: login, import, telegram send, payroll generate

### Wave 5 — UX Polish
- **Language consistency**: semua 3 layout → Indonesia (Pendapatan POS, Pembelian Supplier, Kas Kecil, Pengeluaran, Laporan Harian, Analitik, Absensi, Penggajian, Peringatan, Konfigurasi, dll)
- **Empty state CTAs**: contextual messages + action buttons
- **Form feedback**: success/error messages, delete confirmation, validation

### Yang perlu manual
1. `npm run db:generate` + `npm run db:migrate` di ykp-erp (schema baru: settlement_difference, label/unit/severity/isActive, action_tracker, telegram_log, environment)
2. Deploy Railway untuk test live

### Item revisi belum addressed
- Item 4 (cross-transaction linking `source_module`/`linked_*`) — butuh schema change besar, deferred
- Item 11 (shift swap/conflict detection) — partial di hr-v1, belum di ykp-erp
- Item 12 (doctor letter upload) — belum
- Item 18 (GPS/photo attendance) — deferred V1.1
- Item 26 (user management UI) — RBAC matrix ada, UI belum
- Item 28 (environment color coding) — env tags ada, warna belum per spec

---

## Track C — Operational Module

**Status:** belum dibangun sama sekali
**Brief:** `YKP_ERP_Operational_Developer_Brief_V1.txt`
**Roadmap:** Phase 2 (setelah HR + Finance stabil), 2–4 minggu

### Goal brief
- Pusat kontrol aktivitas harian outlet.
- 10 modul: Operational Overview, Briefing & Shift Board, Opening Checklist, Live Ops/KDS Basic, Visual QC, Incident & Complaint, Closing Reconciliation, Waste & Stock Issue Log, Analytics & Configurations, Operational Daily Summary.
- Spreadsheet boleh untuk non-real-time; KDS real-time butuh real-time DB.
- Output: `ops_daily_summary` untuk Hermez.

### ✅ Sudah jadi
- Tidak ada. Sesuai plan (out of Phase 1).

### ⏸️ Belum
- Semua: schema `ops_*`, app, UI, master checklist template, product, ingredient, incident type, KDS, QC, waste, closing reconciliation, summary.

### Gap vs goal
0% — sesuai plan, bukan keterlambatan.

---

## Track D — Marketing Module

**Status:** belum dibangun
**Brief:** disebut di migration brief + roadmap Phase 3
**Roadmap:** Phase 3 (setelah core finance + operations jalan), 2–4 minggu

### Goal brief
V1: campaign, content calendar, IG scheduler, WA blast planner, review monitor, marketing summary.

### ✅ Sudah jadi
- Tidak ada.

### Gap vs goal
0% — sesuai plan.

---

## Hermez AI Layer (lintas track)

**Status:** infra done, belum live dengan data verified
**Brief:** `YKP_Hermez_Developer_Brief_Migration_V1.docx`, `_brief_text.txt`, roadmap Phase 5

### Goal brief
- Baca `hr_daily_summary` + `fin_daily_summary` (nanti + `ops_daily_summary`).
- Buat YKP Daily Brief untuk owner.
- Buat alert: staff telat tinggi, selisih kas, expense naik, supplier overdue, petty cash tidak wajar.
- Simpan ke `hermez_daily_brief` + `hermez_alert_log`.
- Kirim via Telegram.
- **Bukan tempat input operasional.** Tidak edit data, tidak transfer uang. Semua action butuh approval.

### ✅ Sudah jadi
- `ykp-erp/apps/hermez` — brief generator, alerts, config, run, telegram-test, brief-cron worker.
- `hermez-brief.ts` engine + 7 triggers + cron (`HERMEZ_RUN_HOUR_UTC=15` = 22:00 WIB).
- `hermez_alert_log` + `hermez_daily_brief` schema.
- Read-only boundary enforced (`no-write-back.ts`, `HERMEZ_WRITEBACK_ENABLED=false` hard-coded).
- Telegram bot `@justatestermaybot` + owner chat id configured.
- Recent fixes: redirect `/login` on 403, SSO mint SUPER_ADMIN, Hub→ERP SSO bridge, SameSite=none cookie.

### ⏸️ Belum / blocked
- Belum baca summary asli — sekarang mock data, bukan hr/fin summary verified.
- Daily brief ke owner belum live production — cron ada, data source belum stabil.
- Hermez full integration (AI insight, SOP bot, weekly report) — out of scope V1, Phase 5 roadmap.

### Gap vs goal
Hermez V1 (baca summary → daily brief → alert) **infra done**, belum live karena data source (HR + Finance summary) belum verified dari pilot.

---

## Hub / SSO Bridge

### ✅ Sudah jadi
- Hub → ERP SSO via `GET /api/auth/login?role=&redirect=`.
- SameSite=none cookie untuk cross-origin.
- Preview button pakai `window.open` (bukan iframe cross-origin).
- Hermez SSO mint SUPER_ADMIN.
- x-forwarded-host redirect fix.
- CSP frame-ancestors configured.

---

## Goal Arsitektur (target akhir)

```
HR App + Finance App + Operational App + Marketing App + Moka Export
        ↓
Spreadsheet / Database Layer (YKP)
        ↓
Daily Summary Layer
  hr_daily_summary | fin_daily_summary | ops_daily_summary
        ↓
Orchestration Layer
        ↓
Hermez AI Command Center
        ↓
Owner Brief / Alert / Dashboard / Telegram
```

**Status sekarang:**
- HR App + Finance App + Hermez App → ✅ infra live (mock data)
- Daily Summary Layer → ✅ schema + generator (mock)
- Operational + Marketing → ❌ belum
- Orchestration Layer → ❌ belum (Phase 4)
- Hermez live brief ke owner → ❌ tunggu data verified

---

## Prinsip Non-Negotiable (lintas brief) — status kepatuhan

| Prinsip | Status |
|---|---|
| Jangan bangun semua modul sekaligus — HR + Finance dulu | ✅ diikuti |
| Mulai 1 brand pilot, baru rollout | ⏸️ belum mulai pilot |
| Semua modul share master data sama | ✅ schema ready |
| Setiap modul hasilkan daily summary | ✅ hr + fin (ops belum) |
| Hermez bukan input app | ✅ enforced |
| Timestamp, PIC/user, audit log | ✅ |
| V1 boleh spreadsheet tapi clean + migration-ready | ✅ hr-v1 Sheets + ykp-erp Postgres |
| Angka finance auditable | ✅ schema + mock; belum verified asli |

---

## Yang Bisa Dikerjakan Sekarang (tanpa owner)

1. **Phase 4 hr-v1** — wire 4 approval UI button (leaves, adjustments, payroll approve, payroll mark-paid).
2. **Phase 5–6 hr-v1** — logout + employee row actions + HR Overview filters.
3. **Login UI ykp-erp apps.**
4. **Operational App V1** (Phase 2) — mulai mockup → schema.
5. **PDF payslip, GPS validator** (deferred V1.1, bisa dikerjakan).

## Yang Blocked Owner

1. GCP service account + spreadsheet share (hr-v1).
2. Master brand/outlet/employee/supplier asli YKP.
3. Aturan shift, payroll, lateness, leave.
4. Data absensi lama 7–30 hari + POS Moka 7–30 hari.
5. Akun testing app existing + screenshot + bug notes.
6. Ganti password owner default.
7. Pilot 7 hari + training admin.

---

## Next Session Priority

1. **P0 verify:** stabilize hr-v1 `/hr/lateness` SSR; clock-in idempotency; rotate `owner123`.
2. **Phase 4 sisa:** payroll Approve + Mark-paid + adjustments Approve/Reject UI (API sudah ada).
3. **ykp-erp unit red:** export `@ykp/engine/triggers` + fix HR summary mock brand.
4. **Hermez hydration React #418** + profile HR attendance API ~37s.
5. Finance dashboard zero-cards / Rebuild Today reliability on Railway.
6. Phase 5 sisa: employee edit/deactivate + Phase 6 overview filters.
7. Login UI ykp-erp (design choice) — sekarang role-picker SSO only.
8. Phase 7 (deferred): PDF payslip, GPS, Telegram, QR, photo upload.
9. Tunggu owner data pack → bootstrap Sheets dengan data asli → start pilot 7 hari.
10. Re-run gate: `node tests/deep-verify-api-correct.mjs` + `node tests/deep-verify-hrv1-retest.mjs`.
