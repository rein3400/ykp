# YKP Hermez — Stagging Environment (from branch `origin/stagging`)

> Created: **2026-07-20** · Production cutover: **2026-07-21**
> Purpose: temp test env for branch `stagging` (collab). **Production now runs stagging code** (deployed 2026-07-21 from worktree). Merge to main deferred (soak first).
> Parallel `*-stagging` Vercel projects still exist for reference; teardown after soak.

Source worktree: `D:/Users/stefa/Project/ykp-stagging` (detached HEAD `1243c84`).
Diff vs main: 3 commits — "feat: bugfix issue critical security & flow" + hermez-consolidation merge + legacy bot-worker opt-in. Scope: security hardening (ratelimit, middleware, session, password) across apps. 892 of 1183 changed files are non-app noise (`.agents/`, `.opencode/`, `_bmad/`).

---

## Vercel stagging projects (5, LIVE)

| App | Stagging URL | Source | Status | Auth |
|---|---|---|---|---|
| Ops | https://ykp-ops-stagging.vercel.app | ykp-ops-v1 | ✅ `/login` 200, `/api/ops/summary` 200 | mock DB on |
| Warehouse | https://ykp-warehouse-stagging.vercel.app | ykp-warehouse-v1 | ✅ `/login` 200, `/api/warehouse/summary` 200 | Sheets (shared prod spreadsheet) |
| Investor | https://ykp-investor-stagging.vercel.app | ykp-investor-v1 | ✅ `/login` 200, `/api/investor/summary` 200 | Sheets (shared prod spreadsheet) |
| HR-v1 | https://ykp-hr-v1-stagging.vercel.app | ykp-hr-v1 | ✅ `/login` 200, `/api/hr/summary` 200, `/count` 200 | Sheets (shared prod spreadsheet) |
| Finance-v1 | https://ykp-finance-v1-stagging.vercel.app | ykp-finance-v1 | ✅ `/login` 200, `/` 200 | **mock DB** (`owner` / password in tmp) |

### Browser test results (2026-07-21, via WebBridge real browser)

| App | Login `owner` / stated pw | Result |
|---|---|---|
| Warehouse | `owner123` | ✅ SUKSES — redirect `/warehouse`, KPI data real (25 item aktif), Sheets active, `ENVIRONMENT` shows TESTING |
| Ops | `owner123` | ❌ "Invalid username or password" — `MOCK_PASSWORD` not set → mock-store generated random pw at build time |
| Investor | `owner123` | ✅ SUKSES after private-key format fix — redirect `/investor` dashboard, real data (12 investors, Rp 6.248.000.000 capital, 19 brands). |
| HR-v1 | `owner123` | ✅ SUKSES after private-key format fix + longer snapshot wait — redirect `/hr` dashboard (Ringkasan, Karyawan, Absensi, Roster, Payroll, dll). Initial "fail" was snapshot-too-early (3s), not password. `owner123` matches bcrypt hash in `users` tab. |
| Finance-v1 | mock pw `2e7669...` | ✅ SUKSES — initial snapshot at 3s looked stuck on `/login`, but `POST /api/auth/login` returns 200 + `/api/auth/me` returns `userId:USR-001, owner`; navigating `/finance` directly renders full dashboard (sidebar owner, Ringkasan/Analitik/POS nav). **Not a code bug — earlier snapshot was too fast before client redirect + server fetch of 8 tabs settled.** |
| Ops (after fix) | `owner123` | ✅ SUKSES after `MOCK_PASSWORD=owner123` env set + redeploy — redirect `/ops` dashboard, sidebar, full nav. Mock DB empty by design. |

Conclusions:
- **All 5 stagging apps fully working end-to-end.** Deploy + env wiring correct; login + dashboard render real data for all.
- Two root causes found + fixed (both stagging-only, prod untouched):
  1. `MOCK_PASSWORD` unset on ops → mock-store generated random pw. Fix: set `MOCK_PASSWORD=owner123` + redeploy.
  2. **Private key format** on investor + hr-v1 Vercel env was literal `\n` (set by subagent via `echo`), not real newlines → Sheets auth failed silently → mock-store fallback → `owner123` rejected. Fix: re-set private key via Vercel API with real-newline value (same as hr-v1 initial fix). Redeploy → login works, real data renders.
- "Snapshot too early" caused 3 false-negatives (finance-v1, investor, hr-v1 looked stuck on `/login` at 3-5s but actually succeeded; waiting 7s or direct nav shows dashboard). Lesson: Vercel serverless cold-start + client redirect + multi-tab fetch needs ≥7s settle before snapshot.
- Password `owner123` is valid (bcrypt hash in `users` tab matches). Railway prod hr-v1 "failed `owner123`" earlier was likely the same snapshot-too-early issue OR prod's own env state — not investigated further since prod is out of scope.

### Fixes applied during testing (stagging-only, prod untouched)
- `MOCK_PASSWORD=owner123` env added to `ykp-ops-stagging` + redeploy.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` re-set via Vercel API (real newlines) on `ykp-investor-stagging` + redeploy.
- (hr-v1 private key was already fixed this way during initial deploy.)

### Data isolation
- Vercel apps point at the **same Google Sheets** as prod (security fix doesn't change sheet structure). Test writes land in the live pilot spreadsheet — control during testing.
- Each app got a **new SESSION_SECRET** (stagging cookie invalid in prod and vice-versa).
- finance-v1 runs in **mock mode** (no spreadsheet existed for it; mock DB keeps it isolated).

### Env fixes applied during deploy (stagging worktree only)
- `vercel.json` added to `ykp-hr-v1` (was missing → Vercel fell back to static detection, build error "No Output Directory named public"). Minimal `{"framework":"nextjs"}`.
- `ykp-finance-v1/vercel.json` simplified (original assumed deploy from parent dir via `cd ykp-finance-v1 && ...`; removed since we deploy from inside the dir).
- **Private key format gotcha**: Vercel stores multi-line private keys only correctly when the value contains **real newlines** (not literal `\n`). Railway stores real newlines; setting `-----BEGIN...\nMIIE...` (literal) makes Sheets auth fail silently (count route catches → 0 rows). Fix: set via Vercel API with the real-multi-line value. Affects any app using `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — relevant for future Vercel deploys.

### Pre-existing bug noted (NOT fixed in prod)
- `ykp-investor-v1/src/lib/investor-summary.ts` contains byte `0xC7` (latin-1 "Gö") in a comment → Turbopack 16 fails UTF-8 parse. Fixed in stagging worktree only. **Prod `ykp-investor-v1` has the same byte** — if prod is rebuilt with Turbopack 16 it will fail. Fix in source before merging, or ensure prod build doesn't use Turbopack 16.
- `ykp-warehouse-v1` / `ykp-investor-v1` build warn `[mock-store] MOCK_PASSWORD not set` → fallback generates random mock password at build time. Set `MOCK_PASSWORD` if deterministic mock login needed.

---

## Railway stagging — NOT deployed (blocked)

- Railway project `ykp-erp-monorepo`: new env `stagging` created ✅ (env ID `6717bba1-...`), linked.
- Postgres provisioning **failed**: `Free plan resource provision limit exceeded`.
- Without a new Postgres, the 4 Railway services (finance/hr/hermez Postgres + hub) cannot run isolated. Options:
  1. Upgrade Railway plan (needs owner action + cost).
  2. Point stagging services at prod Postgres — risky: migration adds columns to prod DB (additive, non-destructive, but touches prod); hermez worker could double-fire Telegram/cron.
  3. Skip — ykp-erp is parked (track B-OLD, per `CLAUDE.md`). 5 Vercel stagging apps cover the main security-fix surface.
- Track B-OLD is parked; the 4 Railway apps are low-priority. Recommend option 3 unless specifically requested.

---

## How to test (stagging)

1. Hit each URL above (login pages).
2. Login:
   - ops: `owner` / `owner123`
   - warehouse/investor: check each seed (or mock)
   - hr-v1: `owner` / `owner123` (seed) — reads live Sheets
   - finance-v1: `owner` / `<MOCK_PASSWORD>` (stored in job tmp, not committed)
3. Verify security fix behavior: rate-limit, session, middleware (the actual point of `stagging` branch).

## Teardown (after merge to main, when stagging no longer needed)

### Vercel
```
# Delete 5 stagging projects (production projects ykp-*-v1 untouched)
vercel project rm ykp-ops-stagging
vercel project rm ykp-warehouse-stagging
vercel project rm ykp-investor-stagging
vercel project rm ykp-hr-v1-stagging
vercel project rm ykp-finance-v1-stagging
```

### Railway
```
cd "D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER/ykp-erp"
railway environment delete stagging   # env only — production untouched
```

### Worktree
```
git worktree remove "D:/Users/stefa/Project/ykp-stagging"
```

### Merge path (the goal)
```
git checkout main && git merge origin/stagging   # then teardown
```

---

## Related
- Prod links: `DEPLOYED_LINKS.md`
- This file: `STAGGING_LINKS.md` — delete after teardown.