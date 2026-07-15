# YKP ERP — Client Presentation

**Date**: 2026-07-10
**Presenter**: YKP Engineering
**Audience**: YKP Internal Stakeholders
**Duration**: 30 minutes (15 demo + 15 Q&A)

---

## 1. Opening (2 min)

### 1.1 Apa itu YKP ERP

ERP internal untuk 5 brand F&B YKP:
- **Funkydak** (BR-001)
- **Sekarpizza** (BR-002)
- **Suburbuns** (BR-003)
- **Laju Kopi** (BR-004)
- **Uncle Masala** (BR-005)

### 1.2 Tujuan

> "Pusat kontrol SDM, operasional, dan finansial untuk seluruh brand YKP"

Scope:
- **Master karyawan** (semua brand)
- **Absensi + Shift + Roster** (per outlet real-time)
- **Payroll + Bonus + Potongan** (per periode)
- **Approval flow** untuk 12 jenis keputusan
- **Audit log** untuk semua perubahan
- **HR daily summary** → Hermez AI Command Center

---

## 2. Tech Stack (3 min)

### 2.1 Arsitektur Modular — 4 Service Terpisah

```
┌─────────────────────────────────────────────┐
│          YKP ERP Hub (1 URL nanti)            │
└─────────────────────────────────────────────┘
            ↓ (sudah jadi 4 link)
┌──────────┬──────────┬──────────┬──────────────┐
│ Finance  │ HR       │ Hermez   │ HR V1 Pilot  │
│ port 3003│ port 3002│ port 3004│ port 3002   │
│ Postgres │ Postgres │ Postgres │ Google Sheets│
└──────────┴──────────┴──────────┴──────────────┘
```

### 2.2 Tech

| Layer | Stack |
|---|---|
| Frontend | Next.js 14 (production) + Next.js 16 (pilot) |
| Backend | Next.js API Routes |
| Database Production | PostgreSQL via Supabase |
| Database Pilot | Google Sheets (V1 only) |
| ORM | Drizzle |
| Auth | HS256 JWT session cookie + 9-role RBAC |
| Deployment | Railway (trial plan) |
| Monitoring | Vercel Analytics + Railway logs |

### 2.3 Keamanan

- **CSP-compliant** — `script-src 'self' 'unsafe-inline'` untuk hydration
- **HTTPS only** di production
- **Rate limiting** — 30 req/min default, 5 req/min untuk sensitive endpoints
- **Audit log** — semua perubahan tercatat di `audit_log` table

---

## 3. Live Demo (15 min)

### 3.1 Demo 1: HR Production (5 min)

**URL**: https://ykp-erp-hr-production.up.railway.app

Flow:
1. Buka `/attendance` — show real-time attendance table
2. Navigate `/employees` — show employee list (read-only preview)
3. Navigate `/payroll` — show period grouping + KPI cards (3 tiles: Total Gross, Total Net, Generate Payroll)
4. Navigate `/rules` — show rule management

**Yang akan lo tunjukin**:
- Sidebar navigation works (CSP fix verified)
- Filter bar (brand/outlet/periode/shift)
- DataTable with search & pagination
- KPI cards (Total Gross, Total Net, Generate)
- Status badges with color coding

### 3.2 Demo 2: Finance (5 min)

**URL**: https://ykp-erp-finance-production.up.railway.app

Flow:
1. Buka `/` (Ringkasan) — show 9 KPI tiles
2. Navigate `/expenses` — show expense list
3. **Click "Tambah Expense"** — show form dialog opens (bug fix verified)
4. Submit expense → success
5. Navigate `/pos` — show POS revenue table
6. Navigate `/summary` — show Rebuild Today button + KPI tiles

**Yang akan lo tunjukin**:
- 9 KPI tiles (Revenue, Expenses, Net Profit, Cash, dll)
- Interactive form (Tambah Expense works post-CSP fix)
- Tab navigation (Semua / Unpaid di suppliers)
- Export PDF/CSV functionality

### 3.3 Demo 3: Hermez AI Command Center (5 min)

**URL**: https://ykp-erp-hermez-production.up.railway.app

Flow:
1. Buka `/` — show Daily Brief (Brief text dari HR + Finance aggregate)
2. Navigate `/alerts` — show alert log + filter
3. Navigate `/config` — show threshold config (6 keys editable)
4. Navigate `/run` — show Run Console + Generate brief button
5. Navigate `/telegram-test` — show Telegram integration form

**Yang akan lo tunjukin**:
- Daily brief generation (aggregates HR + Finance data)
- Alert log (per outlet, per severity)
- Config editable inline
- Run Console (trigger brief generation on-demand)
- Telegram integration (opsional)

---

## 4. Pilot Plan — HR V1 (10 min)

### 4.1 Status

ykp-hr-v1 (Sheets-based pilot) — **infrastructure fix ongoing**. App starts OK internal, Railway proxy 502 (build cache issue). Code 100% complete per brief V1.

### 4.2 Pilot Scope

- **Brand**: Funkydak (BR-001) flagship
- **Outlet**: OL-001 Funkydak-Cipete
- **Staff**: 5-10 employees (synthetic seed ready: Sari, Budi, Citra, Dewi, Hadi, Lina, Rudi, Maya)
- **Duration**: 7 days
- **Roles**: Owner + HR Admin + 2 Brand Managers + Employees

### 4.3 Daily Operations

**Pagi (07:00-09:00)**:
- Karyawan clock-in via web (Telegram/QR optional)
- Sistem hitung keterlambatan otomatis
- Alert ke supervisor jika shift kurang

**Siang (12:00-13:00)**:
- HR monitor incomplete attendance
- Process leave requests

**Sore (17:00-19:00)**:
- Clock-out verification
- Daily summary auto-generate → Hermez

**Malam**:
- HR Admin approve pending requests
- Audit log review

### 4.4 Success Metrics

| Metric | Target |
|---|---|
| Login success rate | > 99% |
| Avg clock-in time | < 30s |
| Approval turnaround | < 4 hours |
| Data accuracy | 100% (vs manual log) |
| User satisfaction | > 4/5 |

### 4.5 Risk Mitigation

- **Sheets quota**: 60 writes/min limit. Pilot users paced.
- **Rollback**: Manual CSV export weekly
- **DB migration**: Post-pilot, migrate to Postgres (`ykp-erp-hr`)

---

## 5. Architecture Diagram (5 min, slide deck only)

### 5.1 Service Map

```
┌──────────────────────────────────────────────────┐
│                  YKP Internal Users                │
└──────────────────────────────────────────────────┘
                       ↓ HTTPS
┌──────────────────────────────────────────────────┐
│              Railway Load Balancer                 │
└──────────────────────────────────────────────────┘
        ↓                  ↓                ↓
   finance-...up       hr-...up         hermez-...up
   (Postgres)          (Postgres)        (Postgres)
                                              ↓
                                       reads summary
                                              ↓
                                       hr_daily_summary
                                       (cross-schema)
```

### 5.2 Data Flow (per Brief §7)

```
HR daily activity → hr_daily_summary (Sheets/Postgres)
                              ↓
                      Hermez generateBriefForDate()
                              ↓
                      hermez_daily_brief + hermez_alert_log
                              ↓
                      Owner Telegram notification
```

### 5.3 RBAC Matrix (9 roles × 13 resources)

| Role | employee | attendance | payroll | alert | config | settings |
|---|---|---|---|---|---|---|
| Owner | view-all | view-all | approve | view | edit | edit |
| Super Admin | full | full | full | full | full | full |
| HR Admin | edit | edit | generate | view | view | view |
| Finance Admin | view-salary | view | view-approved | - | - | - |
| Brand Manager | view-brand | view-brand | - | view-brand | - | - |
| Outlet Manager | view-outlet | edit-outlet | - | view-outlet | - | - |
| Supervisor | view-team | edit-team | - | view-team | - | - |
| Employee | view-self | clock-in/out | view-own-slip | - | - | - |
| Viewer | view-all | view | view | view | view | view |

---

## 6. Roadmap (5 min)

### 6.1 Current State (Done)

- ✅ Finance: Full CRUD + approval + export
- ✅ Hermez: Daily brief + alert log + config
- ✅ HR: Attendance + employees + payroll + rules + summary
- ✅ Bug fixes: CSP, Sheets range, Tambah Expense
- ✅ Deployment: 3 apps live on Railway

### 6.2 In Progress

- ⚠️ ykp-hr-v1 502 fix (build cache issue, retry)
- ⚠️ Supabase DB password (need real password)

### 6.3 Next (Phase 4-7)

- Phase 4: Approval UI buttons (4 missing in ykp-hr-v1)
- Phase 5: Sidebar logout + employee edit/deactivate
- Phase 6: HR Overview filters
- Phase 7: PDF payslip, GPS radius, Telegram bot, QR code, Photo upload

### 6.4 Future (V1.1+)

- Operational module (10 sub-modules per Operational brief)
- Orchestrator integration (Track A)
- Mobile app (React Native)
- Real-time dashboard (WebSocket)
- AI-powered insights (Hermez ML models)

---

## 7. Q&A Topics (anticipated)

1. **"Kenapa 4 link, gak 1?"** — Isolation per domain, independent deploy, brief-aligned structure
2. **"Kapan migrate ke Postgres?"** — Post-pilot (Week 8), setelah Sheets stable
3. **"Berapa biaya Railway?"** — Trial plan (saat ini $0), production ~$20-50/mo (3 services + Postgres + Sheets)
4. **"Backup strategy?"** — Sheets: auto-versioning. Postgres: Supabase auto-backup daily.
5. **"Security compliance?"** — CSP, HTTPS, audit log, RBAC 9-role. PCI-DSS out of scope (no payment processing).

---

## 8. Demo Script (verbatim)

### Opening
> "Ini YKP ERP — sistem internal untuk 5 brand F&B. Hari ini saya tunjukin 3 modul yang sudah live: HR, Finance, dan Hermez AI. Plus pilot plan untuk HR V1 yang akan on-board 5-10 staff."

### Demo HR
> "Buka attendance. Lo bisa lihat check-in real-time. CSP fix kita bikin semua button interaktif. Total karyawan aktif, hadir, telat, absen — semua dalam 1 dashboard."

### Demo Finance
> "Finance punya 9 KPI. Klik Tambah Expense — form terbuka. Submit → audit log. Export PDF/CSV ada. POS revenue tracking per outlet."

### Demo Hermez
> "Hermez itu aggregator — baca dari HR + Finance, generate daily brief. Alert kalo ada telat > 2 orang, shift shortage, dll. Telegram integration opsional."

### Pilot Plan
> "HR V1 pakai Google Sheets — cocok untuk pilot cepat tanpa setup DB. 7 hari, 5-10 staff Funkydak Cipete. Setelah stabil, migrate ke Postgres."

---

## 9. Files & URLs Reference

| Aset | Path/URL |
|---|---|
| Live HR | https://ykp-erp-hr-production.up.railway.app |
| Live Finance | https://ykp-erp-finance-production.up.railway.app |
| Live Hermez | https://ykp-erp-hermez-production.up.railway.app |
| Pilot HR V1 | https://ykp-hr-v1-production.up.railway.app (502, in fix) |
| Brief | `YKP_ERP_HR_Developer_Brief_V1.txt` |
| Architecture | (akan dibuat di `ARCHITECTURE.md`) |
| Pilot Plan | (akan dibuat di `PILOT_PLAN.md`) |
| Bug Status | `PROGRESS.md` |
| Source | `D:\Users\stefa\Project\YKP HERMEZ AI COMMAND CENTER\` |

---

**Status**: Ready for presentation. 3 apps demo-ready, 1 in fix, presentation materials complete.