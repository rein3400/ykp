# Deep Verification Report — vs PROGRESS_STATUS

> Snapshot: **2026-07-12**  
> Method: CLI HTTP (correct routes) + Playwright click-one-by-one (live Railway) + local vitest  
> Artefacts:
> - `tests/deep-verify-2026-07-12.json` (pass 1, noisy false-crits included)
> - `tests/deep-verify-hrv1-retest.json` (pass 2 hr-v1, authoritative for UI gaps)
> - `tests/deep-verify-api-correct.json` (pass 2 API, authoritative for routes)
> - `tests/screenshots/deep-verify-2026-07-12/`

---

## Verdict

| Gate | Result | Note |
|---|---|---|
| Feature **exists** (Phase 1 HR+Finance+Hermez infra) | **MOSTLY YES** | Routes/pages live on Railway |
| Feature **works** (happy path under mock data) | **PARTIAL** | Core CRUD/read OK; several UI/action gaps |
| **Production-ready** | **NO** | Mock data, flaky SSR, slow endpoints, missing approval UI, unit test red, default password |
| Pilot 7-hari DoD | **NO** | Owner data pack still blocker |

**Production gate (strict):** FAIL  
- critical/flaky 5xx observed · unit tests not fully green · no real YKP data · pilot not started · default `owner/owner123` still live

---

## Live surface matrix

| App | URL | Auth | Root | SSO/Login | Data |
|---|---|---|---|---|---|
| Finance | `ykp-erp-finance-production.up.railway.app` | SSO `OWNER` | 200 | 302 + cookie | mock Postgres |
| Hermez | `ykp-erp-hermez-production.up.railway.app` | SSO `SUPER_ADMIN` | 200 | 302 + cookie | mock Postgres |
| HR (erp) | `ykp-erp-hr-production.up.railway.app` | SSO `OWNER` | 307→/attendance | 302 + cookie | mock Postgres |
| HR V1 | `ykp-hr-v1-standalone-production.up.railway.app` | `owner/owner123` | 307→login | POST 200 + cookie | Google Sheets mock |
| Hub | `ykp-hub-production.up.railway.app` | localStorage role | 200 | Sign in UI | portal only |

---

## 1. Track B-OLD — ykp-erp Finance

### Exists / works

| Surface | Exists | Works | Evidence |
|---|---|---|---|
| Pages `/`, `/pos`, `/suppliers`, `/petty-cash`, `/expenses`, `/summary`, `/analytics`, `/settings`, `/login` | ✅ 200 | ✅ render | Playwright pass 1 |
| API `GET /api/fin/summary\|pos\|expense\|petty-cash\|supplier\|unpaid` | ✅ | ✅ 200 + `{data}` | API correct pass |
| API analytics revenue/profit | ✅ | ✅ 200 (month totals) | revenue `725957816` mock |
| SSO GET `/api/auth/login?role=OWNER` | ✅ | ✅ 302 public origin + cookie | no `0.0.0.0` leak |
| Unauth API gate | ✅ | ✅ 403 on `/api/fin/pos` | |
| Buttons: Tambah Cost, Edit, Bayar, Tambah Expense, Approve, Kirim | ✅ | ✅ dialog/api | click pass |
| Login page (role-picker style) | ✅ | ✅ Login → nav | 1 input + button |

### Bugs / gaps

| Sev | Finding | Evidence |
|---|---|---|
| **MED** | Dashboard `/` shows many `Rp 0` cards (empty/latest-day fallback still weak under empty “today”) | Playwright body scan; rebuild path on `/summary` |
| **MED** | `/summary` **Rebuild Today** click → no dialog/nav/api observed in pass 1 | button inert under click harness (possible client handler miss or needs form state) |
| **MED** | `/api/fin/master-data` & `/api/fin/closing-cash` → **400 validation** without required query | route exists, contract strict |
| **LOW** | `/api/fin/export/csv` → **405** on GET (method not allowed — export likely POST/stream) | |
| **MED** | Rate-limit 429 under parallel automated load (known; raised previously) | historical + HR pages mid-run |
| **N/A false-pos** | First CLI used wrong paths (`/api/fin/expenses` plural, `/api/master/brands`) → 404 | corrected: singular `/expense`, `/supplier`, `/master-data` |

### Production standards

- Error envelope `{error:{code,message}}` ✅  
- Auth cookie gate ✅  
- No stack leak observed ✅  
- Real Moka validation ❌ (mock)  
- Login is role-picker (no credential) — **not production auth**

---

## 2. Track B-OLD — ykp-erp Hermez

### Exists / works

| Surface | Exists | Works | Evidence |
|---|---|---|---|
| Pages `/`, `/alerts`, `/config`, `/run`, `/telegram-test`, `/login` | ✅ 200 | partial | |
| API config/brief/alerts | ✅ | ✅ 200 | brief `HZBR-20260712` level yellow |
| `POST /api/hermez/run` | ✅ | ✅ 200 | **~28s**, returns `alert_count:29` |
| Telegram test route | ✅ | 400 without `message` (expected) | validation OK |
| Unauth gate | ✅ | 403 | |
| Config **Simpan**, alerts **Ubah**, telegram **Kirim** | ✅ | ✅ api | |
| Read-only boundary | ✅ (code) | not write-probed destructive | `HERMEZ_WRITEBACK_ENABLED=false` in source |

### Bugs / gaps

| Sev | Finding | Evidence |
|---|---|---|
| **HIGH** | **React hydration error #418** on `/`, `/alerts`, `/config`, `/run`, `/telegram-test` | Playwright `pageerror` every Hermez page |
| **MED** | `/run` **Generate brief** click sometimes no effect (handler/hydration race) | pass 1; POST `/api/hermez/run` works via CLI |
| **MED** | Run latency **~28s** — borderline for interactive UX / platform timeout risk | CLI timing |
| — | Live brief uses **mock** HR/FIN summaries — not pilot-verified | data layer |

### Production standards

- SUPER_ADMIN SSO mint ✅  
- Stack not leaked ✅  
- Hydration #418 = **not production-clean UI**  
- Daily brief to real owner Telegram not verified this run (telegram/test needs body; bot may be live separately)

---

## 3. Track B-OLD — ykp-erp HR

### Exists / works

| Surface | Exists | Works | Evidence |
|---|---|---|---|
| `/attendance`, `/employees`, `/payroll`, `/rules`, `/summary` | ✅ | partial | 429 mid-run on rules/summary/login |
| API summary/employees/attendance/payroll/rules | ✅ | ✅ 200 | |
| `+ Karyawan`, payroll **Generate** dialog | ✅ | ✅ dialog | |
| Unauth 403 | ✅ | ✅ | |

### Bugs / gaps

| Sev | Finding | Evidence |
|---|---|---|
| **HIGH** | `GET /api/hr/attendance` latency **~37s** | CLI correct pass — **prod risk** (timeouts, UX) |
| **MED** | Rate limit 429 during sequential browser walk | `/rules`, `/summary`, `/login` mid pass 1 |
| **MED** | Local unit: `attendance-smoke` fails — mock brand `"missing"` not found in `generateHrDailySummary` | vitest 1 failed / 16 passed |
| **HIGH** | Local suite: `hermez-brief-smoke` **fails to load** — `Missing "./triggers" specifier in "@ykp/engine"` | package exports gap |
| — | No real credential login UI (SSO role-picker only) | design |

---

## 4. Track B-NEW — ykp-hr-v1 (pilot target)

### Exists / works (retest authoritative)

| Surface | Exists | Works | Evidence |
|---|---|---|---|
| Login `owner/owner123` | ✅ | ✅ → `/hr` | |
| `/hr`, employees, new, attendance, roster, lateness, leaves, payroll, generate, adjustments, summary | ✅ **200** (retest) | ✅ render + data | lateness shows 30 records, penalty totals |
| API employees/attendance/leaves/adjustments/roster/summary | ✅ | ✅ 200 `{data}` | |
| `POST /api/hr/payroll/generate` (UI Generate) | ✅ | ✅ 200 | retest click |
| Approval **API** routes leaves/adjustments/payroll approve + mark-paid | ✅ | 400 empty body (route alive) | contract requires payload |
| Leaves UI **Setujui / Tolak** | ✅ | present per row | retest buttons |
| Employee dropdown leaves/adjustments | ✅ | 8 employees loaded | **known issue FIXED** vs PROGRESS.md |
| Logout button | ✅ | present | **Phase 5 logout DONE** vs PROGRESS claim |
| Unauth employees | ✅ | 401 | |
| Public summary allowlist | ✅ | 200 unauth OK by design | |

### Bugs / gaps

| Sev | Finding | Evidence |
|---|---|---|
| **HIGH** | **Phase 4 incomplete on Payroll UI**: no Approve / Mark-paid buttons (only Logout + link to generate) | retest `/hr/payroll` buttons=`["Logout"]` |
| **HIGH** | **Phase 4 incomplete on Adjustments UI**: no Approve/Reject row actions (only Logout + Simpan form) | retest |
| **HIGH** | `/hr/lateness` **intermittent SSR 500** (pass 1 fail ERROR digest, pass 2 200) | flaky server component — **not production stable** |
| **MED** | Multi-click **Clock in** can surface 5xx / race; single click → **201** | pass 1 CRIT (batch); retest 201 for EMP-001 |
| **MED** | `/hr/employees/new` **Simpan** no effect without valid filled form (expected) but no client validation feedback observed | |
| **MED** | No list GET `/api/hr/payroll` — payroll only via generate/approve/mark-paid/payslip | API design gap for “list all runs” consumers |
| **LOW** | Missing CSP + `X-Content-Type-Options` on root | security headers |
| **CRIT (ops)** | Default password **`owner123` still live on production URL** | pilot checklist violation |

### Phase checklist vs PROGRESS_STATUS

| Item (PROGRESS) | Verified now |
|---|---|
| Phase 4 leaves approve/reject UI | ✅ **wired** (Setujui/Tolak) |
| Phase 4 adjustments approve/reject UI | ❌ **missing** |
| Phase 4 payroll approve UI | ❌ **missing** |
| Phase 4 payroll mark-paid UI | ❌ **missing** |
| Phase 5 logout | ✅ **present** |
| Employee dropdown empty (known) | ✅ **fixed** |
| GPS / PDF / Telegram / QR | not retested (deferred V1.1) |

---

## 5. Hub

| Check | Result |
|---|---|
| `/` 200 | ✅ |
| Sign in button → api | ✅ |
| X-Content-Type-Options | ❌ missing (LOW) |
| Full SSO embed click-through this run | not deep-tested (prior memory: SameSite=none + window.open preview) |

---

## 6. Track A — Orchestrator (local only)

| Check | Result |
|---|---|
| `npm test` vitest | ✅ **18/18 pass** (scoring, risk, session, mt5-mock, …) |
| Live trading / KB / Telegram signal | not production-verified (paused per PROGRESS_STATUS) |

---

## 7. Unit tests summary

| Package | Result |
|---|---|
| `orchestrator` | ✅ 5 files, 18 tests |
| `ykp-hr-v1` | ✅ 6 files, 28 tests |
| `ykp-erp` | ❌ 2 failed suites / 1 failed test · 16 passed |
| | `apps/hermez/test/hermez-brief-smoke.test.ts` — `@ykp/engine` missing `./triggers` export |
| | `apps/hr/test/attendance-smoke.test.ts` — mock brand id not found |

---

## 8. Non-negotiable principles (spot-check)

| Principle | Live check |
|---|---|
| Hermez not write-back input app | Config/run only; no HR/FIN mutation APIs on hermez ✅ |
| Currency integer IDR display | UI shows `Rp …` ✅ |
| 5xx envelope no stack | Production digest only on lateness SSR; API JSON errors clean ✅ |
| Auth cookie | SSO + hr-v1 session ✅ |
| Summary layer for Hermez | fin+hr summary APIs return data ✅ (mock) |
| Real YKP master data | ❌ mock |
| Pilot 7 days | ❌ |

---

## 9. Ranked open bugs (actionable)

### P0 — block any “production / pilot go”

1. **Default credentials live** on hr-v1 (`owner/owner123`) — rotate before any real user.  
2. **Mock data only** — DoD Phase 1 cannot close.  
3. **hr-v1 `/hr/lateness` flaky SSR 500** — must stabilize (repro intermittent).  
4. **ykp-erp unit suite red** — fix `@ykp/engine` `./triggers` export + HR summary mock.

### P1 — break trust / UX hard

5. **Hermez React #418 hydration** on all main pages.  
6. **HR attendance API ~37s** — investigate query/N+1/Sheets-or-DB plan.  
7. **Hermez run ~28s** — async job / progress UX.  
8. **Payroll + Adjustments approval UI missing** (API exists, buttons don’t).  
9. **Finance dashboard all-zero** when today empty — verify latest-day fallback still shipping on Railway.

### P2 — polish / hardening

10. Rate limit 429 under modest sequential browser traffic (HR).  
11. Finance Rebuild Today click reliability.  
12. Security headers on hr-v1 / hub (CSP, XCTO).  
13. Finance export CSV method contract documented.  
14. Clock-in double-submit resilience (idempotent day lock).

### Cleared vs old PROGRESS known issues

- ~~hr-v1 leaves employee dropdown empty~~ → **fixed** (8 names).  
- ~~hr-v1 adjustments dropdown empty~~ → **fixed**.  
- ~~hr-v1 logout missing~~ → **fixed** (Logout visible).  
- Leaves approval UI → **done** (still need adjustments + payroll).

---

## 10. Feature scorecard (PROGRESS_STATUS claims)

| Track claim | Exists | Works | Prod | Notes |
|---|---|---|---|---|
| A Orchestrator modules + tests | ✅ | ✅ local | ❌ paused | no live trade loop |
| B-OLD Finance deployed 200 | ✅ | ✅ partial | ❌ mock + zeros 0 risk | |
| B-OLD Hermez brief/alerts/config | ✅ | ⚠ hydration | ❌ | run works CLI |
| B-OLD HR pages/API | ✅ | ⚠ slow + 429 | ❌ | |
| B-NEW hr-v1 9 sections | ✅ | ⚠ flaky lateness | ❌ | pilot not started |
| B-NEW approval UI “11 missing” | partial | leaves OK | — | payroll/adj still missing |
| Hermez read-only | ✅ | ✅ | ✅ pattern | |
| Hub SSO bridge | ✅ | ✅ SSO 302 | demo auth | |
| C Operational | ❌ | — | — | out of Phase 1 |
| D Marketing | ❌ | — | — | out of Phase 1 |

---

## 11. Reproduction commands

```bash
# Full suite (from repo root; uses system Chrome)
node tests/deep-verify-2026-07-12.mjs

# hr-v1 retest only
node tests/deep-verify-hrv1-retest.mjs

# Correct API paths
node tests/deep-verify-api-correct.mjs

# Unit
cd orchestrator && npm test -- --run
cd ykp-hr-v1 && npm test -- --run
cd ykp-erp && npm test -- --run
```

SSO cookie (erp):

```
GET {app}/api/auth/login?role=OWNER|SUPER_ADMIN&redirect=/
```

hr-v1 login:

```
POST /api/auth/login  {"username":"owner","password":"owner123"}
```

---

## 12. Recommended next engineering order

1. Fix **lateness SSR flake** + **clock-in idempotency** (hr-v1).  
2. Wire **payroll Approve + Mark paid** and **adjustments Approve/Reject** buttons (Phase 4 remainder).  
3. Fix **@ykp/engine triggers export** + HR summary unit mock.  
4. Fix **Hermez hydration #418**.  
5. Profile **HR attendance 37s** query.  
6. Confirm Finance **latest-day dashboard fallback** on deployed build; fix Rebuild Today if dead.  
7. Rotate hr-v1 owner password; only then invite pilot.  
8. Owner data pack → re-run this suite as regression gate.

---

## 13. Bottom line

Infra claims in `PROGRESS_STATUS.md` are **largely true**: apps are up, SSO works, core APIs return mock data, hr-v1 login and most sections operate.

They are **not production / not DoD-complete**:

- Data mock, no pilot.  
- Approval UI still incomplete (payroll + adjustments).  
- Real defects: Hermez hydration, HR attendance latency, lateness flake, unit red, default password.  
- Several “known issues” in PROGRESS are already fixed (dropdowns, logout, leaves approve) — status doc should be updated.

**Do not mark Phase 1 done.** Safe label: *“deployed mock demo + pilot-ready code path, with open P0/P1 defects.”*
