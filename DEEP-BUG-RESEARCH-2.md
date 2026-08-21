# Deep Bug Research 2 — V1 Modules

Newly found bugs across the six V1 modules (`ykp-warehouse-v1`, `ykp-finance-v1`,
`ykp-hr-v1`, `ykp-investor-v1`, `ykp-ops-v1`, `ykp-hermez`), beyond the four
fixed in this goal (warehouse batch_stock upsert, finance self-approve guard,
warehouse alert dedupe, finance optimistic-concurrency guard).

Each entry: `file:line` · severity · repro · fix suggestion.

Severity legend: CRITICAL (data corruption / auth bypass / PII leak) · HIGH
(silent wrong data / fraud vector) · MEDIUM (latent / scope leak) · LOW.

---

## ykp-warehouse-v1

### CRITICAL

1. **`src/app/api/warehouse/transfer/route.ts` (cancel handler)** — Cancel
   flips transfer to `CANCELLED` with no `logAudit` call (approve/dispatch/
   receive all audit). State mutation goes unrecorded.
   - Repro: `PUT {action:'cancel'}` on a REQUESTED transfer → row flipped, no
     `system_audit_log` row.
   - Fix: add `logAudit({module:'warehouse', action:'cancel', ...})` after
     `updateRow`.

### HIGH

2. **`src/lib/stock-ledger.ts:86-92`** — Lost-update race: `stock_before` is
   picked by lexicographic `movement_datetime` max, not row/insertion order.
   Two concurrent receipts in the same WIB second produce identical
   timestamps → `reduce` returns an arbitrary one → `stock_before` wrong,
   ledger drifts.
   - Repro: two `POST /receiving` in the same second for the same
     item/location → both compute the same `stock_before`.
   - Fix: tiebreak by appended row number (from `appendRows` return) instead
     of datetime string.

3. **`src/app/api/warehouse/transfer/route.ts:164,212`** — Dispatch/receive
   qty defaults to `Number(it.requested_qty)` / `Number(it.dispatched_qty)`
   with no `>= 0` / `Number.isFinite` guard. A client `qty: -10` posts a
   `TRANSFER_OUT` of `-10` → `stock_after` increases by 10 (negative stock
   fraud / inversion).
   - Repro: `PUT {action:'dispatch', items:[{item_id:X, qty:-10}]}` → stock
     increases.
   - Fix: reject `qty < 0` or NaN; clamp is not enough for a fraud vector.

4. **`src/app/api/warehouse/waste/route.ts:42,55`** — `qty`/`unit_cost` use
   `Number(body.qty||0)` with no finite check; `Number("abc")` → NaN stored
   as `"NaN"`. Also waste creates no ledger `WASTE` movement, so waste never
   reduces book stock → permanent ledger vs physical drift.
   - Repro: `POST waste {qty:"abc"}` → `qty:"NaN"`; or valid waste → bookStock
     unchanged.
   - Fix: validate finite, round to integer IDR, post a `WASTE` `OUT`
     movement.

5. **`src/app/api/warehouse/purchase-request/route.ts:148-176`** —
   Approve/reject set `approved_by = s.userId` with no `assertNotSelfApproval`
   (SoD). A user can approve their own purchase request — a fraud vector the
   brief lists in `REQUIRES_APPROVAL`.
   - Repro: user creates PR (`requested_by=U`), then `PUT {action:'approve'}`
     themselves → approved.
   - Fix: `assertNotSelfApproval(found.row.requested_by, s.userId,
     'purchase_request')`.

6. **`src/app/api/warehouse/transfer/route.ts:146-148`** — Transfer approve
   lacks the SoD check (same class as #5).
   - Repro: create transfer, then self-approve.
   - Fix: `assertNotSelfApproval(header.requested_by, s.userId, 'transfer')`.

7. **`src/app/api/warehouse/stock-count/route.ts:80-88`** — Stock count is
   set `status:'COMPLETED'` immediately with no approval, and no
   `COUNT_ADJUSTMENT` ledger movement is posted for the variance → book
   stock never reconciles to the physical count.
   - Repro: POST stock_count with physical_stock differing from book → count
     COMPLETED, `bookStock` unchanged forever.
   - Fix: post a `COUNT_ADJUSTMENT` movement (or require an approval step
     that posts it) for over-tolerance variances.

8. **`src/app/api/warehouse/stock-issue/route.ts:75-78`** — Stock issue auto
   sets `approval_status:'APPROVED'` and posts the `ISSUE` movement on
   creation, with no approval gate and no SoD between `requested_by` and
   `issued_by`.
   - Repro: `POST stock_issue` → instantly APPROVED, stock reduced.
   - Fix: gate issue on approval or enforce SoD.

### MEDIUM

9. **`src/app/api/warehouse/adjustment/route.ts:37,120`** —
   `qty_difference` stored as raw client string; `Number("abc")` → NaN posts
   to ledger as `quantity:NaN, stock_after:NaN` on approve. Only truthy check
   exists.
   - Repro: `POST adjustment {qty_difference:"abc"}` → accepted, NaN to ledger
     on approve.
   - Fix: `Number.isFinite(Number(body.qty_difference))` guard.

10. **`src/app/api/warehouse/batch-stock/route.ts:45,67,88`** —
    `Number(body.current_qty)` with no finite check; `"abc"` → NaN →
    `NaN <= 0` is false → status stays ACTIVE, no alert; `current_qty:"abc"`
    stored.
    - Repro: `POST batch_stock {current_qty:"abc"}` → ACTIVE, no alert.
    - Fix: `Number.isFinite` guard.

11. **`src/app/api/warehouse/notify/daily-brief/route.ts:20-21`** — Falls
    back to `summaries[summaries.length - 1]` (last appended row, not latest
    by date) when today's summary is missing → can send an old summary's KPIs.
    - Repro: no today summary → brief composed from a days-old row.
    - Fix: return `SKIPPED` when today is missing (no fallback), or sort by
      date and take the latest.

12. **`src/app/api/warehouse/actions/route.ts:27-35`** — GET auto-marks
    OVERDUE in-memory but never persists via `updateRow` → API returns
    OVERDUE while the sheet row stays OPEN; subsequent PUTs read OPEN again.
    - Repro: action with `due_date < today`, status OPEN → GET OVERDUE, sheet
      OPEN.
    - Fix: persist the overdue transition, or don't mutate the read objects.

### LOW

13. **`src/app/api/warehouse/receiving/route.ts:151`** — `qty_accepted` can
    exceed `qty_delivered` with no validation (more received than delivered
    accepted silently).
    - Repro: `{qty_delivered:10, qty_accepted:15}` → accepted 15.
    - Fix: validate `qty_accepted <= qty_delivered`.

14. **`src/app/api/warehouse/closing/route.ts:39`** — Closing variance
    `status` threshold is hardcoded `> 5%`; owner SOP (fraud-controls) flags
    `> 2%`. Inconsistent threshold across paths.
    - Fix: align to 2% per owner SOP.

15. **`src/lib/telegram.ts:50-52`** — `sendTelegram` `fetch` has no
    `AbortSignal.timeout`; a hanging Telegram API stalls the route/cron to
    platform timeout.
    - Fix: `AbortSignal.timeout(10000)`.

16. **`src/lib/repo.ts:70-82`** — `nextSequentialId` (scanned max+1 variant)
    is not atomic; concurrent calls return the same N. Currently routes use
    the race-free `nextSequentialIdSync`, so this is a latent footgun.
    - Fix: use `nextSequentialIdSync` everywhere; mark the scanned variant
      unsafe under concurrency.

17. **`src/app/api/warehouse/receiving/route.ts:244-246`** —
    `evalReceivingDiscrepancy` is called with `it.item_id` as the 5th
    (`receivingId`) argument, making the alert title use the item id while
    `reference_id` is the receiving id — inconsistent labeling.
    - Fix: pass `receivingId` as the 5th argument.

---

## ykp-finance-v1

### CRITICAL

1. **`src/app/api/finance/audit/route.ts:15`** — Audit redaction is a no-op:
    `REDACTED_FIELDS = ['beforeValue','afterValue']` (camelCase) but the
    sheet columns are `before_value`/`after_value` (snake_case). `delete
    copy[f]` never matches → public GET returns full PII/payment payloads
    (amounts, supplier bank accounts, payment refs). The "already-fixed"
    redaction used the wrong field names.
    - Repro: `GET /api/finance/audit` (no auth) → rows still contain
      `before_value`/`after_value`.
    - Fix: `['before_value','after_value']`.

2. **`src/app/api/finance/suppliers/[id]/approve-payment/route.ts:50-125`** —
   The pay path reads `unpaid_amount`, computes `newPaid`, writes via plain
   `updateRow` with no `guardedUpdateRow`. Two concurrent pay calls on the
   same invoice both read the same `unpaid_amount` → one payment silently
   lost, `payment_status` corrupted. The two approve routes are guarded;
   this higher-value path is not.
   - Repro: two concurrent `POST .../approve-payment {action:'pay',
     paid_amount:250000}` on a 500000 invoice → one payment lost.
   - Fix: wrap the write in `guardedUpdateRow(TABS.supplierCost,
     'costing_id', params.id, found, next)`.

### HIGH

3. **`src/app/api/finance/suppliers/[id]/route.ts:33-48`** — Supplier cost
   PATCH `add_payment` is an unguarded read-modify-write → double-count /
   lost payment race (same class as #2).
   - Repro: two concurrent `PATCH .../suppliers/X {add_payment:100000}` →
     only 100000 recorded.
   - Fix: `guardedUpdateRow` on `updated_at`.

4. **`src/app/api/finance/closing-cash/route.ts:68`** —
   `Math.trunc(Number("Rp 500.000"))` → NaN when `opening_cash` is
   non-numeric; `opening = NaN` → `expected_cash:"NaN"`,
   `cash_difference:"NaN"` stored, corrupting the record and the downstream
   `latestCashDifference` summary / CASH_DIFFERENCE alerts.
   - Repro: `POST /closing-cash {opening_cash:"Rp 500.000", ...}` → `NaN`
     stored.
   - Fix: `Number.isFinite` guard on user-supplied opening.

5. **`src/app/api/finance/expenses/[id]/route.ts:30-32`** — Expense PATCH
   amount validation `Number(next.amount) <= 0` passes for `NaN` (`NaN <= 0`
   is false); `amount:"Rp 1.000.000"` stored verbatim, becomes 0 downstream.
   Same for supplier PATCH `unit_price`/`qty`.
   - Repro: `PATCH /expenses/X {amount:"Rp 1.000.000"}` → stored, summary
     treats as 0.
   - Fix: validate/normalize to integer IDR on PATCH, reject NaN.

6. **`src/app/api/finance/petty-cash/route.ts:79-82`** — Running balance
   `last` sort tiebreaks by `created_at` (WIB-second precision); two rows in
   the same second get identical `created_at` → `.at(-1)` is
   non-deterministic → `prevBalance` can be the pre-update balance →
   balances diverge. Combined with no optimistic-concurrency on the POST,
   concurrent pairs both compute from the same `last`.
   - Repro: two concurrent `POST /petty-cash` (credit_out) same
     account/date → balances don't chain.
   - Fix: tiebreak by `petty_id` (ts-based, monotonic), or serialize
     per-account writes.

### MEDIUM

7. **`src/app/api/finance/petty-cash/route.ts:50-119`** — POST does not
   enforce per-account `daily_limit` from `fin_petty_cash_account`; the
   `PETTY_CASH_OVER_LIMIT` alert fires post-hoc but the mutation allows
   overspend.
   - Repro: `POST /petty-cash {credit_out:2000000}` on a 500000
     `daily_limit` account → accepted.
   - Fix: sum today's `credit_out`, reject if `+ credit > daily_limit`.

8. **`src/app/api/finance/petty-cash/route.ts:56-58`** — Rejects any row
   where both debit and credit are 0, but closing/physical-count rows
   (`PC-CLOSE-*`) have exactly that with a `physical_cash`. The schema and
   `/balance` expect them; the POST cannot create them.
   - Repro: `POST /petty-cash {debit_topup:0, credit_out:0,
     physical_cash:500000}` → 400.
   - Fix: allow `debit===0 && credit===0` when `physical_cash` is provided.

9. **`src/app/api/finance/suppliers/[id]/approve-payment/route.ts:88-91`** —
   Auto-creates a petty-cash OUT row with no balance-sufficiency check →
   `running_balance` can go negative, and no `daily_limit` guard; also
   bypasses the optimistic-concurrency the manual petty-cash POST lacks.
   - Repro: pay a 2.000.000 invoice via petty_cash on a 500.000 balance →
     `running_balance:-1500000`.
   - Fix: re-read last row, check `newBalance >= 0` and `daily_limit`.

10. **`src/lib/moka-importer.ts:228-233 & 204`** — POS import sums
    `grossSales`/`discount`/`refund` across all method rows per
    (date,outlet); if the Moka export repeats gross per method row, the
    summary overstates gross (double-count). Depends on export shape.
    - Fix: take gross/discount/refund from the first row per (date,outlet),
      or detect method-level vs summary-level rows.

### LOW

11. **`src/app/api/finance/notify/daily-brief/route.ts:25-34`** — Daily
    brief alert filter is not scoped to `date`; it lists every OPEN/ACK
    alert ever created → stale alerts from weeks ago in the "daily" brief.
    - Fix: filter alerts to `a.date === date`.

12. **`src/lib/telegram.ts:182-196`** — `consumeLinkCode` reads, checks
    `consumed_at`, writes via plain `updateRow` → a code can be consumed
    twice (same chat id bound, second caller's chat id wins on `users`).
    - Fix: re-read + `guardedUpdateRow` on the link-code row.

13. **`src/app/api/finance/settings/route.ts:21-39`** — A `finance_admin`
    can repoint `telegram_owner_chat_id` to any chat id (including an
    attacker channel) with only `update:telegram` RBAC.
    - Fix: restrict `telegram_owner_chat_id` changes to `owner`/
      `super_admin`, or validate + confirm.

14. **`src/app/api/finance/alerts/route.ts:14-34` / `actions/route.ts:15-30`**
    — Public GET returns `assigned_to`/`action_taken`/`resolved_at` with no
    field redaction (audit was redacted for the same reason).
    - Fix: redact those fields for unauthenticated callers.

---

## ykp-hr-v1

### CRITICAL

1. **`src/app/api/hr/employees/import/route.ts:110`** —
   `basic_salary: String(Number(p.basic_salary))` does NOT strip `Rp`/`.`/
   `,`; `"Rp 5.000.000"` → `Number` → NaN → stored as `"NaN"`. Payroll
   `generate` does `Number(e.basic_salary || 0)` → 0 → employee salary
   silently zeroed.
   - Repro: upload CSV with `basic_salary=Rp 1.500.000` → stored `NaN`,
     payroll 0.
   - Fix: use `parseIdr(p.basic_salary)`.

### HIGH

2. **`src/app/api/hr/employees/import/route.ts:100`** — `join_date` defaults
   to `new Date().toISOString().slice(0,10)` (UTC). At 00:01–06:59 WIB the
   UTC date is the previous day → imported employees get yesterday's join
   date → payroll pro-ration off by one day.
   - Repro: import at 01:00 WIB on 2026-08-21 → `join_date` 2026-08-20.
   - Fix: default to `todayWib()`.

3. **`src/app/api/hr/attendance/correction/route.ts:55-58`** — The self-only
   RBAC guard block body is **empty** (only a comment). Any authenticated
   user can POST a correction against any employee's `attendance_id`. The
   "staff correct own attendance only" rule is never enforced.
   - Repro: as employee A, POST correction with B's `attendance_id` → 201.
   - Fix: inside the block, check `session.employeeId ===
     found.row.employee_id`, else `forbidden()`.

### MEDIUM

4. **`src/app/api/hr/adjustments/route.ts:14`, `employees/route.ts:26`** —
   `z.coerce.number().min(0)` / `z.coerce.number()` accept decimals
   (`5000.5`) → fractional IDR propagates to `net_salary`. Invariant §2
   mandates integer IDR.
   - Fix: use `.int()` or `Math.round()` before storing.

5. **`src/app/api/hr/employees/import/route.ts:45-55`** — `nextEmployeeId()`
   scans max `EMP-NNN`+1 with no lock; two concurrent imports → duplicate PK
   (Sheets has no unique constraint). The single-create route re-checks via
   `findRow`; import does not.
   - Repro: two simultaneous CSV imports → both insert `EMP-001`.
   - Fix: use `nextSequentialIdSync('EMP')`, or add a `findRow` guard.

### LOW

6. **`src/app/api/hr/telegram-actor/route.ts:18`** —
   `req.headers.get('x-bot-secret') !== botSecret` is a non-constant-time
   compare on the shared bot secret (timing side-channel).
   - Fix: use `safeEqual()` from `@/lib/cron`.

---

## ykp-investor-v1

### HIGH

1. **`src/app/api/investor/summary/route.ts:9`** — Public Hermez endpoint:
   when today has no rows, returns `rows.slice(-10)` (last 10 of any date) →
   leaks cross-date investor financials (total_capital, dividend_declared,
   revenue) to unauthenticated callers.
   - Repro: `GET /api/investor/summary` on a no-data date → 10 stale rows.
   - Fix: return empty when no rows for today.

2. **`src/app/api/investor/capital/route.ts:27`** — `amount: body.amount ??
   '0'` with no numeric validation; `"abc"`, `"Rp 5.000"`, `"5000.5"` stored
   verbatim → `regenerateInvestorSummary` `Number(c.amount||0)` → NaN →
   `total_capital=NaN`. Violates integer-IDR invariant §2. (`dividend/route.ts`
   validates `/^-?\d+$/`; capital does not.)
   - Repro: `POST capital {amount:"Rp 5.000.000"}` → stored, summary NaN.
   - Fix: validate `/^-?\d+$/` or `parseIdr`.

### MEDIUM

3. **`src/lib/investor-summary.ts:165-167`** — Growth `prev.filter((r) =>
   r.date !== d).slice(-1)[0]` takes the last row by sheet order, not the
   latest by date before `d`. Out-of-order appends/backfills → `growth_pct`
   computed against an arbitrary baseline.
   - Fix: sort by date and take the row immediately before `d`.

### LOW

4. **`src/lib/investor-summary.ts:230,248`** — Alert rows include a `title`
   key, but `investor_hermes_alert_log` headers have no `title` column →
   silently dropped (the `message` embeds `title:` as a workaround).
   - Fix: add `title` to the tab headers, or drop the key.

---

## ykp-ops-v1

### CRITICAL

1. **`src/lib/ops-summary.ts:89 & :125`** — Idempotency broken: line 89
   looks up existing summary by `summary_id === \`${outletId}-${date}\``,
   but line 125 assigns new rows `summary_id = nextSequentialIdSync('SUM')`
   → `OPS-YYYYMMDD-NNN`. The lookup key and written key never match → every
   regenerate appends a duplicate summary row; sheet grows unbounded; Hermez
   reads stale duplicates.
   - Repro: `POST /api/ops/summary/regenerate` twice for the same date → 2
     rows.
   - Fix: set `row.summary_id = \`${outletId}-${date}\`` for new rows.

2. **`src/db/sheets.ts:196-199`** — `appendRows` reads `A:A` to compute
   `startRow`, then appends at `range: A${startRow}` **without**
   `insertDataOption: 'INSERT_ROWS'`. The Sheets default is `OVERWRITE`, so
   the row at `startRow` is overwritten; under concurrent/stale reads,
   existing data is destroyed.
   - Repro: two near-simultaneous POSTs → one overwrites the other's row.
   - Fix: `insertDataOption: 'INSERT_ROWS'` (as HR/investor sheets do).

### HIGH

3. **`src/app/api/ops/summary/route.ts:14-18`** — Public Hermez endpoint:
   when no rows match the requested `date`, falls back to `rows.slice(-10)`
   (last 10 rows of any date) and reports `total: filtered.length ||
   rows.length` (all rows). Leaks cross-date operational data (revenue,
   cash_difference, incident counts, waste_value) to unauthenticated callers.
   - Repro: `GET /api/ops/summary?date=2099-01-01` → 10 most recent rows of
     any date.
   - Fix: return empty list when the date has no rows.

4. **`src/lib/ops-summary.ts:80-84`** — `scheduledStaff` hardcoded to 2;
   `actualStaff = Number(staffBrief[0].staffing_warning) + 2`.
   `staffing_warning` is a free-text warning, not a headcount → `actualStaff`
   is garbage and `shift_shortage` is fabricated; these flow into the Hermez
   AI / owner brief.
   - Fix: derive `scheduledStaff` from roster/shift assignments; remove the
     staffing_warning arithmetic.

### MEDIUM

5. **`src/app/api/ops/kds/route.ts:24`** — `Number(body.target_seconds || 180)`:
   `||` treats `0` as falsy → a legitimate `target_seconds: "0"` is replaced
   by `180`, masking SLA misconfiguration and skewing `sla_status`.
   - Fix: `body.target_seconds != null && body.target_seconds !== '' ?
     Number(body.target_seconds) : 180`.

### LOW

6. **`src/app/api/auth/login/route.ts:61`** — SSO bridge `token !== expected`
   is a non-constant-time compare on `ERP_SSO_SECRET` (residual timing
   side-channel; the fail-closed fix is already in place).
   - Fix: `timingSafeEqual`-based compare.

---

## ykp-hermez

### MEDIUM

1. **`src/scope.ts:20-34`** — `filterPerOutlet` and `filterItems` are
   byte-for-byte identical to `filterRows` (all call `matches`, which only
   checks top-level `outlet_id`/`brand_id`). A tool returning grouped rows
   without flattening would pass scope filtering unfiltered → potential
   cross-outlet leak. (Currently `tools.ts` flattens before filtering, so
   narrow.)
   - Fix: implement nesting traversal, or document that all tools must
     flatten first.

2. **`src/tools.ts:24-33`** — `fetchRows` returns `[]` on any non-OK
   response (401, 500, timeout) → the AI answers "data belum ada" instead of
   surfacing an auth/config outage; a misconfigured `botSecret` or down
   module is masked as "no data".
   - Fix: return a tagged `{rows, error}` or surface non-OK status so the AI
     can say "modul X tidak terjangkau".

### LOW

3. **`src/config.ts:47` / `src/index.ts:39`** — The `openAccess` flag
   (`TELEGRAM_OPEN_ACCESS === 'true'`) still exists in config and is honored
   in `index.ts`, granting any chat id owner-scope. Production usage was
   removed, but the flag itself is a live auth-bypass footgun if accidentally
   set in `.env`.
   - Fix: remove the flag from `config.ts` and the `openAccess` branch in
     `index.ts`, or hard-fail startup if set in production.

---

## Severity totals

| Module | CRIT | HIGH | MED | LOW |
|---|---|---|---|---|
| warehouse | 1 | 7 | 4 | 5 |
| finance | 2 | 4 | 4 | 4 |
| hr | 1 | 2 | 1 | 1 |
| investor | 0 | 2 | 1 | 1 |
| ops | 2 | 2 | 1 | 1 |
| hermez | 0 | 0 | 2 | 1 |

Highest-impact for production: finance audit redaction no-op (#1, PII leak),
finance supplier pay double-spend (#2), ops summary_id idempotency (#1, sheet
bloat), HR import salary NaN (#1, payroll correctness), ops sheets
`OVERWRITE` (#2, data destruction).