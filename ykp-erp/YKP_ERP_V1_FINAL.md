# YKP ERP V1 — Final State (deployable)

> Status per 2026-07-09. Track ini **un-parked** — semua 14 residual CRITICAL/HIGH selesai difix. Lanjutan: deploy ke Supabase + Vercel.

## Yang sudah dibangun

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

## Verify pass terakhir (re-verify v5 — 2026-07-09)

- **H (HR): PASS** ✓
- **F (Finance): PASS** ✓ (semua 8 Finance fix selesai)
- **Z (Hermez): PASS** ✓ (Z7 + Z8 selesai)
- **Security: PASS** ✓ (Security 9 + 10 + 14 selesai)
- **Integration: PASS** ✓ (typecheck + 4 new test pass)

## 14 Residual Fix Trail (un-parked 2026-07-09)

### Finance lane (F)
1. ✅ **F1** — Per-outlet seq counter di 5 route (pos, expense, supplier, closing-cash, petty-cash). `where(and(eq(date), eq(outletId)))` ditambahkan sebelum count.
2. ✅ **F2** — `Buffer.byteLength(csvText, "utf8")` ganti UTF-16 `.length`. DoS closed.
3. ✅ **F3** — Seq counter query scope ke `(dates, outletIds)` yang sedang di-insert.
4. ✅ **F4** — `to_char(date, 'YYYY-MM-DD')` di SQL projection; drop `new Date().toISOString()` coercion.
5. ✅ **F5** — `parseIdrAmount` strip leading `-` lalu parse, return magnitude. Refund/void preserved.
6. ✅ **F6** — `notInArray(approvalStatus, ['CANCELLED', 'REJECTED'])` di profit analytics expConds + supConds + pettyConds.

### Hermez lane (Z)
7. ✅ **Z7** — `onConflictDoUpdate.set.sentToOwner` = `sql\`CASE WHEN hermez_daily_brief.sent_to_owner THEN true ELSE excluded.sent_to_owner END\``. Manual re-run tidak re-notify owner.
8. ✅ **Z8** — `hermezAlertId(date, seq)` pakai per-date `alertSeqMap`. Format `HZAL-YYYYMMDD-NNN` compliant.

### Security lane
9. ✅ **Sec 9** — `applyOutletScope(user, conds, column)` helper di `packages/auth/src/scope.ts`. Wired ke 8 GET route (HR 4 + Finance 4). Payroll manual scoping karena `hrPayroll` tidak punya outletId column.
10. ✅ **Sec 10b** — Telegram test: fixed message, log detail server-side. Same for petty-cash FSM + payroll per-employee errors.
11. ✅ **Sec 11** — Moka CSV byte cap covered by F2.
12. ✅ **Sec 14** — Rate limit + CSP/CORS middleware di 3 apps (`apps/{hr,finance,hermez}/src/middleware.ts`). In-memory token bucket per IP (5 req/min sensitive, 30 req/min default).

## Mockup data seed

`packages/schema/src/seed-pilot.ts` — generate 7-day transactional sample untuk pilot testing:
- 35 hr_attendance (PRESENT/LATE/ABSENT/CUTI mix)
- 21 fin_pos_daily (3 outlet × 7 days, dengan -150k refund di day-3)
- 10 fin_supplier_cost (PENDING/APPROVED/PAID mix)
- 15 fin_petty_cash (in/out, DRAFT/PENDING/APPROVED mix)
- 15 fin_expense (PENDING/APPROVED/REJECTED/CANCELLED/DRAFT mix)
- 3 fin_closing_cash (1 per outlet, OL-002 dengan -15k cash diff untuk trigger Hermez warn)
- 2 hr_payroll (current period, PENDING)

Run via `npm run db:seed:pilot`.

## Deployment target (planned)

- **ykp-erp** → Supabase Postgres (4 DB: ykp_master, ykp_hr, ykp_finance, ykp_hermez) + Upstash Redis + Vercel (3 apps: hr, finance, hermez).
- **ykp-hr-v1** → Vercel + Google Sheets.
- **orchestrator (Track A)** → paused, depends on Windows MT5 bridge owner decision.
- **No Cloudflare** — Vercel default `*.vercel.app` only.
- **Telegram** — reuse `@justatestermaybot`.

## Upgrade path V1 → V2

- ykp-hr-v1 (Sheets) pilot 7 hari → stabil
- Migrasi master + attendance + payroll ke ykp-erp Postgres HR DB
- Hermez brief generator (ykp-erp lane Z) reuse dari ykp-hr-v1 summary
- Finance lane (ykp-erp lane F) deploy setelah Supabase provisioned + data pack received

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