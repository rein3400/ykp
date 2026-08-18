# YKP Prod Deep Test Report — 2026-07-22

Session: `ykp-prod-deeptest` · WebBridge group "YKP Prod Deep Test"  
Source of truth: `DEPLOYED_LINKS.md` (prod cutover 2026-07-21, branch `origin/stagging` @ `1243c84`)  
Method: Kimi WebBridge real browser + curl API probes + Railway/Vercel env inspection  
Credentials used: `owner` / `owner123` (Sheets apps); `ERP_SSO_SECRET` for ERP role-picker apps

---

## FIX #6 APPLIED + VERIFIED (2026-07-22 19:28)

**Hub Preview stuck on iframe "Memuat …" → FIXED (user-reported regression).**

Root cause: commit `c5d972b` ("hub preview iframe") **reverted** the earlier fix `513530c` / `f6249ec` that made Preview open a new tab via `window.open(ssoUrl(...))`. It put `previewModule` back to `setActiveModule(id)` → embedded iframe. That design assumed the SSO cookie would stick on an iframe top-level navigation; modern browsers block third-party cookies, so the iframe stays on the "Memuat {app}…" skeleton forever. User correctly identified this as "old feature" — the iframe path that they had already replaced.

Fix: restore `previewModule` = `window.open(ssoUrl(app, role), "_blank")` (same as Buka). Update Preview tooltip from "Preview di hub (iframe)" to "Buka di tab baru (auto-login via SSO)". Applied to both stagging worktree and main.

Deploy: Hub `8e3ce66e` SUCCESS. Verified: page chunk has `window.open` (2×); Preview Finance button title = "Buka di tab baru (auto-login via SSO)"; iframeCount=0 on page.

Git: `acd4116` on `origin/stagging` + `c594b2c` on `origin/main`.

---

## FIX #5 APPLIED + VERIFIED (2026-07-22 18:26)

**Finance Tambah Struk empty-submit silent → FIXED.**

Root cause (corrected diagnosis): the form code already had `missingFields()` + red banner + `onError` surfacing API fieldErrors. The "silent" behavior in the first test was a **false positive** — HTML5 `required` on date/nota/gross/pay-amount inputs triggered browser native validation that *blocked* `onSubmit` before the JS banner could run (only a tiny per-field tooltip showed). When HTML-required fields were filled but outlet/payment_method (Selects, not HTML-required) were empty, the banner DID show ("Lengkapi dulu: Outlet, …").

Fix: add `noValidate` to the `<form>` so `onSubmit` always runs and the red banner lists every missing field at once. Banner now carries `role="alert"` for a11y. `required` attrs kept as screen-reader hints.

Files: `ykp-erp/apps/finance/src/features/finance/components/pos-receipt-form.tsx` (stagging + main working tree). Commit `5ad8271` on `stagging-sso-ops-fix`.

Deploy: `railway up --service ykp-erp-finance` → `e8af966f` SUCCESS.

Verification (WebBridge): empty Simpan Struk → banner `"Lengkapi dulu: Outlet, Nomor Nota, Metode Pembayaran, Gross Sales (> 0)."` with `role=alert`, `hasAlert:true`.

---

## FIX #4 APPLIED + VERIFIED (2026-07-22 18:00)

**Ops prod login owner/owner123 broken → FIXED.**

Root cause: production Vercel env for ykp-ops-v1 had `GOOGLE_SERVICE_ACCOUNT_EMAIL=""` and `YKP_OPS_SPREADSHEET_ID=""` (empty strings). With empty Sheet ID/SA email, Sheets auth failed → `readTab(ops_users)` could not read → login returned 401 regardless of correct password hash. The `ops_users` tab itself **already contained** the seeded `owner` row with `password_hash` = sha256(`owner123`) (verified locally: `matchesOwner123:true`, prefix `43a0d17178a9`).

Note: Ops uses **sha256** password hashing (not bcrypt like HR-v1).

Fix:
1. Extract valid values from local `ykp-ops-v1/.env`: spreadsheet ID `1rdKV6BJ…`, SA email `ykp-hr-v1-svc@…`, SA private key (converted `\n` escapes → real newlines).
2. `vercel env add <KEY> production --force` to override the empty prod values (3 vars).
3. `vercel --prod --yes` redeploy (deployment `dpl_7hm49hk7udZs8xRh5RWxzERxEZFw` READY).

Verification:
- `POST /api/auth/login {owner, owner123}` → **200** `{userId:USR-001, username:owner, role:owner}` (was 401).
- `/api/auth/me` with cookie → 200 owner.
- `/api/ops/summary` → 200.
- Hub SSO to Ops (GET, no password) already worked before this fix.

Note: `vercel env pull` shows sensitive vars as `""` (Vercel does not write decrypted sensitive values to the pulled file) — so the empty pull was misleading; the real check is deploy + live login.

---

## FIX #3 APPLIED + VERIFIED (2026-07-22 17:35)

**Hermez ops-summary proxy 404 → FIXED.**

Root cause: `ops-summary/route.ts` exists on `main` working tree but was **never committed to `origin/stagging`** (missed during hermez-consolidation merge). Prod Hermez builds from stagging → route absent → 404. warehouse-summary was present and worked.

Fix:
1. Copied `ops-summary/route.ts` into stagging worktree `ykp-erp/apps/hermez/src/app/api/hermez/ops-summary/route.ts`.
2. Set Hermez Railway env `OPS_SUMMARY_URL=https://ykp-ops-v1.vercel.app/api/ops/summary` (`railway variable set --skip-deploys`). Route reads `process.env.OPS_SUMMARY_URL` at runtime — no rebuild needed for the URL, but route file itself required rebuild.
3. `railway up --service ykp-erp-hermez --environment production` from stagging worktree `ykp-erp/` (monorepo root; Hermez uses `Dockerfile.hermez.new`). Deploy `a6e93afd` SUCCESS.

Verification (live curl):
- `GET /api/hermez/ops-summary?date=2026-07-22` → **200** `{"data":{"date":"2026-07-22","items":[],"total":0},"source":"ops_v1","fetched_at":"…"}` (was 404 HTML).
- `source:"ops_v1"` confirms proxy hit `OPS_SUMMARY_URL`.

Note: Next build route list in logs did not display `ops-summary` (it omits some 0-B dynamic routes from the printed tree) but the route is live and functional.

---

## FIX #2 APPLIED + VERIFIED (2026-07-22 17:28)

**Hermez SSO from Hub → FIXED.** Also corrected HR SSO misconfiguration.

Root cause findings:
- Hub module `id:"owner"` = Hermez ("Owner Command"), URL = hermez-prod. Hermez login route accepts `token=ERP_SSO_SECRET` + `role=SUPER_ADMIN` (ERP demo SSO) — SSO-compatible.
- Hub module `id:"hr"` = HR-v1 Sheets (Railway standalone). HR-v1 `/api/auth/login` is **POST-only bcrypt** — **no GET SSO bridge**. Having `hr` in `ROLE_SSO_APPS` generated a broken SSO link that would 404/401.

Fix (`ykp-hub/app/components/apps.ts`):
- `ROLE_SSO_APPS`: `["finance","hr","ops"]` → `["finance","owner","ops"]` (add Hermez, **remove hr**).
- `SSO_ROLE`: `{}` → `{ owner: "SUPER_ADMIN" }`.

Deploy: `railway up --service ykp-hub --environment production` → `12243614` SUCCESS.

Verification (WebBridge):
- Hub "Buka Owner Command" link = `…/api/auth/login?role=SUPER_ADMIN&token=f5615a…` (was base URL, no SSO).
- Hub "Buka HR" link = base URL `https://ykp-hr-v1-standalone-production.up.railway.app/` (was broken `/api/auth/login` SSO).
- Navigate Hermez SSO link → 302 `/`, title "YKP Hermez".
- `/api/hermez/config` 200 (was 403), `/api/hermez/brief` 200 (was 403), `/api/hermez/alerts` 200 (was 401). Nav "Konfigurasi" present.
- Chunk `page-03f30b8e6ce873aa.js` contains `M={owner:"SUPER_ADMIN"}`.

**Note:** HR card now opens app root requiring manual `owner`/`owner123` login — expected for a Sheets-auth app without SSO bridge.

---

## FIX #1 APPLIED + VERIFIED (2026-07-22 17:19)

**CRITICAL-1 Hub SSO token empty → FIXED.**

Root cause: Railway Docker multi-stage build **does not inject service env vars into the `RUN npm run build` step** unless the Dockerfile declares them as `ARG`/`ENV` in the builder stage. `NEXT_PUBLIC_*` must be present at `next build` time for Next.js to inline them into the client bundle. The original Hub Dockerfile had no such declaration → bundle baked `token=""`.

Fix applied (in stagging worktree `D:/Users/stefa/Project/ykp-stagging/ykp-hub/`):
1. `app/config.ts` (already uncommitted in stagging): prod URLs hardcoded as `defaultUrl` + static `switch` on env var name (Next only inlines statically-known `process.env.X`, not `process.env[var]`).
2. `Dockerfile`: added `ARG` + `ENV` for all 7 `NEXT_PUBLIC_*` vars in builder stage before `RUN npm run build`.
3. `railway up --service ykp-hub --environment production -d` from stagging worktree (deploy `d6840b71`, SUCCESS).

Verification (WebBridge + curl):
- Page chunk `/_next/static/chunks/app/page-6a81876c4c758443.js` contains literal `l=encodeURIComponent("f5615a97217b2116cfcd0e50998159039d1a2dadc5a92acd")` — secret baked.
- Hub "Buka" links now emit `token=f5615a...` to Finance/HR/Ops (was `token=`).
- End-to-end: navigate Finance SSO with token → 302 redirect to `/`, title "YKP Finance", `GET /api/fin/summary` 200 (was 403 forbidden). **SSO Hub→Finance fully working.**

**Remaining (separate, NOT token): Hub Preview iframe still stuck on "Memuat Finance…"**
- iframe src now has valid token, but cross-origin third-party cookie (`ykp_session` SameSite=none) inside sandboxed iframe still doesn't establish session in some browsers → stays on loading skeleton.
- This is the iframe third-party-cookie issue, downstream of SSO, not the token bug. "Buka di tab baru" works; "Preview di hub" still has the cookie-in-iframe limitation.
- Screenshot: `screenshots/deeptest-hub-preview-finance-after-sso-fix.png` (iframe present with token, but loading skeleton).

**Note:** these stagging worktree changes (config.ts + Dockerfile) are **uncommitted** and live only in `D:/Users/stefa/Project/ykp-stagging/ykp-hub`. Production deploy used the uploaded working-tree content. Commit + merge to stagging/main to keep them.

---

## Executive summary

| Severity | Count | Headline |
|---|---|---|
| **CRITICAL** | 1 | Hub SSO ke Finance/HR/Hermez **broken** — token empty (NEXT_PUBLIC env not baked into Hub build) |
| **HIGH** | 3 | Hermez ops-summary 404; Ops prod login owner/owner123 gagal; Finance Tambah Struk silent validation |
| **MEDIUM** | 2 | Hub Preview iframe stuck loading (downstream of SSO); Hermez Owner card ROWS "—" (proxy lag / empty day) |
| **LOW / fixed** | 4 | Warehouse +Tambah Item OK; Hermez Ubah dialog OK (tool limitation only); HR-v1 Railway summary cold-start only; Investor/Warehouse data real |

**All 9 primary URLs reachable (HTTP 200 on /login or /).**  
**Hub claims 6/6 Online** but SSO from Hub is unusable for Finance/Hermez/HR Postgres.

---

## App-by-app results

### 1. Hub — https://ykp-hub-production.up.railway.app
| Check | Result |
|---|---|
| Login | Already logged in as `owner` / Owner |
| Dashboard | 6/6 Online (Owner Command, HR, Finance, Warehouse, Investor, Ops) |
| Health API | 200 `/api/health` overall ok |
| Preview Finance | iframe opens, stuck "Memuat Finance…" 12s timeout |
| Buka SSO Finance | `token=` empty → 401 `Invalid or missing SSO token` |

**CRITICAL-1 · Hub SSO token empty**
- Code (stagging): `ssoUrl()` emits `token=${process.env.NEXT_PUBLIC_ERP_SSO_SECRET ?? ""}`
- Railway Hub env: `NEXT_PUBLIC_ERP_SSO_SECRET=f5615a97217b2116cfcd0e50998159039d1a2dadc5a92acd` (48 char, **matches** Finance `ERP_SSO_SECRET`)
- Runtime browser: iframe/src and Buka links emit `token=` (empty)
- Root cause: `NEXT_PUBLIC_*` di-bake saat **build**. Hub last SUCCESS deploy 2026-07-21 19:37; env ditambah/diubah tanpa rebuild → client bundle masih string kosong.
- Fix: `railway up --service ykp-hub` (atau redeploy) **setelah** `NEXT_PUBLIC_ERP_SSO_SECRET` ter-set. Verifikasi dengan View Source / Network: `token=` harus 48-char hex.
- Impact: Owner tidak bisa Buka/Preview Finance, Hermez, Ops dari Hub tanpa manual login + password secret.

Also: `ROLE_SSO_APPS` = `{finance, hr, ops}` — **Hermez (Owner Command) TIDAK di ROLE_SSO_APPS** dan `SSO_ROLE` kosong. Hermez "Buka" hanya buka base URL tanpa SSO. Hermez butuh SUPER_ADMIN; Hub harus set `SSO_ROLE.owner = "SUPER_ADMIN"` + include `owner` in ROLE_SSO_APPS.

---

### 2. Finance — https://ykp-erp-finance-production.up.railway.app
| Check | Result |
|---|---|
| GET SSO tanpa token | 401 `Invalid or missing SSO token` |
| Login form (role + Access Password = ERP_SSO_SECRET) | ✅ dashboard Ringkasan |
| Ringkasan | Accounts Payable Rp 95.416.367; revenue hari ini 0 (fallback 2026-07-15) |
| POS | ✅ 100 invoices, Rp 483.105.298 total, source moka, real outlets |
| Receipt expand | Status already `Verified` (bug #2 2026-07-19 not re-confirmed on Pending row) |
| Tambah Struk dialog | ✅ opens |
| Simpan Struk (empty / partial) | **dialog stays open, no error UI** |

**HIGH-2 · Finance "Tambah Struk" silent validation failure**
- UI: click Simpan with empty/partial fields → no toast, no fieldErrors, dialog stays open
- API `POST /api/fin/pos/receipts` returns 400 with clear `fieldErrors` (`date`, `brand_id`, `brand_name`, `outlet_name`, `receipt_number`, `payment_method_id`)
- Form UI does not surface API fieldErrors to the user
- Repro: login Finance → POS → Tambah Struk → Simpan tanpa isi
- Fix: map `error.details.fieldErrors` to form; show banner on non-field errors
- Continuity: same as MEDIUM/HIGH #3 from 2026-07-19 findings (still open)

---

### 3. HR Postgres — https://ykp-erp-hr-production.up.railway.app
| Check | Result |
|---|---|
| GET SSO with valid token | 302 → `/` (tab title empty briefly; session minted) |
| Login form | Role + Access Password (same secret model as Finance) |
| Deep feature | Partial — SSO works with secret; Hub SSO broken (token empty) |

---

### 4. Hermez — https://ykp-erp-hermez-production.up.railway.app
| Check | Result |
|---|---|
| GET SSO `role=SUPER_ADMIN&token=<secret>` | ✅ dashboard Ringkasan Harian |
| Nav | Ringkasan, Peringatan, Actions, Warehouse, Konfigurasi, Jalankan, Tes Telegram, Bot Telegram |
| Config API | 200 (SUPER_ADMIN) |
| Alerts page | 114 rows; many Ubah buttons |
| Ubah dialog | ✅ opens with pointer events (Acknowledge / Resolve / Simpan) — old #7 was WebBridge `click` limitation, not app bug |
| Daily Brief 2026-07-22 | "Belum ada brief … Generate via Run Console" |
| `/api/hermez/warehouse-summary` | 200, data from 2026-07-14 (not today) |
| `/api/hermez/ops-summary` | **404 Next.js HTML** |

**HIGH-1 · Hermez ops-summary proxy 404**
- Source on **main working tree**: `ykp-erp/apps/hermez/src/app/api/hermez/ops-summary/route.ts` exists
- **`origin/stagging` tree does NOT contain** hermez ops-summary route (only ops-v1's own summary)
- Prod Hermez last deploy 2026-07-21 18:51 from stagging → route never shipped
- warehouse-summary proxy exists and works
- Fix: cherry-pick/add ops-summary route into stagging + redeploy Hermez; set `OPS_SUMMARY_URL=https://ykp-ops-v1.vercel.app/api/ops/summary`

---

### 5. HR-v1 Railway — https://ykp-hr-v1-standalone-production.up.railway.app
| Check | Result |
|---|---|
| Login owner/owner123 | ✅ → `/hr`, auth/me owner |
| Nav | Ringkasan, Karyawan, Absensi, Roster, Keterlambatan, Izin/Cuti, Payroll, Bonus, Summary Harian, User |
| `/api/hr/summary?date=2026-07-22` | 200 `{items:[], total_items:0}` (empty day OK) |
| `/api/hr/summary/count` | 200 brand5 / outlet11 / emp20 real |
| Early probe 500 | Transient cold-start — not reproduced after warm |

---

### 6. HR-v1 Vercel — https://ykp-hr-v1.vercel.app
| Check | Result |
|---|---|
| Login API owner/owner123 | ✅ `{userId:U-001, role:owner}` |
| `/api/hr/summary` | 200 empty day |
| `/api/hr/summary/count` | 200 real rows (same Sheets) |

---

### 7. Warehouse — https://ykp-warehouse-v1.vercel.app
| Check | Result |
|---|---|
| Login owner/owner123 | ✅ → `/warehouse` |
| Overview | 25 item aktif, 25 di bawah min, waste 0, generated 2026-07-22 |
| Master Item | table + form |
| `+ Tambah Item` | ✅ form inline opens (Kode, Unit, Simpan, Tutup) — **old #4 FIXED** |
| `/api/warehouse/summary` | 200 real MEGA-WHS data (after warm; early 500 was cold-start) |
| `/api/warehouse/summary/count` | 200 count=152, latest 2026-07-18 |

Note: early warehouse-summary 500 caused Hermez proxy `warehouse_unavailable` — recovered after warm. Worth monitoring cold-start / Sheets auth reliability.

---

### 8. Investor — https://ykp-investor-v1.vercel.app
| Check | Result |
|---|---|
| Login API owner/owner123 | ✅ USR-001 owner |
| `/api/investor/summary` | 200 real MEGA-SUM data (capital 29B, 12 investors) |
| UI deep features | Login OK; capital/dividend pages not fully exercised this pass |

---

### 9. Ops — https://ykp-ops-v1.vercel.app
| Check | Result |
|---|---|
| Login owner/owner123 | ❌ `Invalid username or password` |
| Button stuck | "Masuk…" loading, stays on /login |
| `/api/ops/summary` | 200 empty mock items |
| Vercel env | `USE_MOCK_DB` present; **no `MOCK_PASSWORD`**; Sheets SA + spreadsheet ID present |

**HIGH-3 · Ops prod login broken for seed credentials**
- `vercel env pull` (production) confirms `USE_MOCK_DB=""` (blank) and `ENVIRONMENT=""`
- Blank `USE_MOCK_DB` → app defaults to **Sheets mode** (not mock), but Sheets SA env present
- Login API `POST /api/auth/login {owner, owner123}` → 401 `Invalid username or password`
- Likely cause: prod Ops Sheets **users tab has no owner/owner123 bcrypt hash** (or SA auth fails silently → no users)
- Fix:
  1. Seed Ops Sheets users tab with bcrypt hash for owner/owner123 (same as HR-v1), OR
  2. Explicitly set `USE_MOCK_DB=true` + `MOCK_PASSWORD=owner123` + redeploy if pilot wants mock
- Impact: Ops module unusable for pilot owner; Hub "Buka Ops" would land on login with no valid creds

---

## Public / Hermez-facing endpoints

| Endpoint | Status | Notes |
|---|---|---|
| HR Railway summary | 200 | empty day OK after warm |
| HR Railway count | 200 | real data |
| HR Vercel summary/count | 200 | real data |
| Warehouse summary | 200 | real after warm (early 500 cold-start) |
| Warehouse count | 200 | 152 rows |
| Ops summary | 200 | empty mock |
| Hermez warehouse-summary proxy | 200 | data dated 2026-07-14 |
| Hermez ops-summary proxy | **404** | route not in stagging deploy |
| Investor summary | 200 | public? returns data unauthenticated |
| Hub health | 200 | 6/6 |

---

## Old findings (2026-07-19) status

| # | Finding | Status 2026-07-22 |
|---|---|---|
| HIGH #2 Finance verify receipt | Not re-tested on Pending row (all sampled Verified) | open? |
| HIGH #3 Finance Tambah Struk silent fail | **CONFIRMED still open** | open |
| HIGH #4 Warehouse +Tambah Item | **FIXED** | closed |
| HIGH #5 Warehouse +Receiving Baru | not re-tested this pass | unknown |
| MEDIUM #1 Hub Preview | Still broken, now explained by SSO token | open (CRITICAL root) |
| MEDIUM #7 Hermez Ubah | **NOT a bug** — WebBridge synthetic click limitation; works with pointer events | closed |

---

## Fix priority (recommended order)

1. **Redeploy Hub** after confirming `NEXT_PUBLIC_ERP_SSO_SECRET` is set → unblocks all Hub SSO + Preview.
2. **Add Hermez to Hub ROLE_SSO_APPS** with `SSO_ROLE.owner = "SUPER_ADMIN"` (or dedicated owner app id).
3. **Ship ops-summary route** to stagging/prod Hermez + set `OPS_SUMMARY_URL`.
4. **Ops login**: set `MOCK_PASSWORD=owner123` or fix Sheets users + USE_MOCK_DB=false.
5. **Finance form**: surface API fieldErrors on Tambah Struk (and similar forms).
6. Optional: re-test Finance verify on a Pending receipt; re-test Warehouse Receiving form.

---

## Evidence artifacts

- Screenshot: `screenshots/deeptest-hub-preview-finance.png` (iframe stuck loading)
- Secrets used for verification (do not commit elsewhere):
  - `ERP_SSO_SECRET` / `NEXT_PUBLIC_ERP_SSO_SECRET` = 48-char hex (Railway production)
- WebBridge session: `ykp-prod-deeptest` (close when done)

---

## Not tested / partial this pass

- Finance: expenses, petty-cash, suppliers, analytics deep CRUD
- Warehouse: Receiving Baru form, waste, ledger write
- Investor: capital/dividend UI actions, regenerate
- Hermez: Run Console cron, Telegram test live send
- HR Postgres deep pages after SSO
- HR-v1: clock-in, payroll approve (already known working 2026-07-19)
- Marketing module (not deployed by design)
- Orchestrator (paused)
