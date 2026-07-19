# YKP Investor V1 — Governance & Disclosure Model

This document codifies the disclosure model **as implemented** in this
repository. It is the contract for what each role can see and where every
investor-facing number comes from. If the code and this document ever
disagree, treat it as a bug and fix one of them.

## Roles

| Role      | Who | Session |
| --------- | --- | ------- |
| `owner`   | YKP ownership / management | full access |
| `investor`| External capital partner, bound to one `investor_id` | scoped access |

Sessions are 24 h HS256-signed httpOnly cookies (`ykp_investor_session`).
Every API route re-checks the session; the middleware blocks unauthenticated
API calls with 401. Logins are rate-limited and passwords are bcrypt-hashed
(legacy sha256 hashes are transparently migrated on first login).

## What an `investor` account sees

An investor session (`role = 'investor'`, `investorId = INV-xxx`) sees:

- **Own portfolio / cap-table positions** — `GET /api/investor/portfolio`
  and `/investor/portfolio` filter `investor_shareholding` to their own
  `investor_id`.
- **Own capital history** — `GET /api/investor/capital` filters
  `investor_capital` to their own `investor_id`.
- **Own dividends** — `GET /api/investor/dividend` filters
  `investor_dividend` to their own `investor_id`.
- **Own returns** — `/investor/returns` computes ROI for their own
  `investor_id` only.
- **Group-level aggregates** — the dashboard (`/investor`,
  `GET /api/investor/dashboard`) and the public summary endpoints expose
  group totals only: total revenue, total profit, total capital, active
  investor count, cumulative dividend declared, growth %.

An investor account **never** sees:

- Outlet-level P&L, per-outlet revenue, expenses, or cash counts.
- Payroll, HR, attendance, or employee data of any kind.
- Supplier costs, supplier terms, invoices, or purchase data.
- **Other investors' positions** — no other investor's capital rows,
  dividends, shareholding, or ROI (enforced by the `investor_id` filters
  above, on both the API routes and the server-rendered pages).
- Audit logs, the user table, or any write capability (investor role is
  read-only; all POST endpoints require `owner`).

## What an `owner` account sees

Everything: all investors' capital, dividends, shareholding and ROI rows,
the audit log, and the write endpoints (`POST /api/investor/capital`,
`POST /api/investor/dividend`, `POST /api/investor/summary/regenerate`).

## Where investor-facing numbers come from

All investor-facing **group** numbers derive from the daily summary:

- `investor_daily_summary` is written **only** by
  `POST /api/investor/summary/regenerate` (owner session required). It is
  upserted by deterministic ID (`SUM-YYYYMMDD`) — re-runs are idempotent.
- Per summary date it computes:
  - `total_revenue` / `total_profit` — group-level finance cross-read of
    `fin_daily_summary` (read-only, via `YKP_FINANCE_SPREADSHEET_ID`) for
    that date. Revenue = `net_sales`, profit = `estimated_surplus`
    (finance's own "estimated cash surplus" — real net profit needs COGS,
    which V1 does not have). No outlet-level fields are read or stored.
  - `total_capital` — cumulative capital (`in` − `out`) up to the date.
  - `active_investors` — count of `master_investor` rows `status=active`.
  - `dividend_declared` — cumulative declared dividends (declared + paid)
    up to the date.
  - `growth_pct` — day-over-day revenue growth vs the previous calendar
    day; empty when there is no previous-day baseline.
- `GET /api/investor/summary` and `GET /api/investor/summary/count` are
  public (used by the YKP hub and the read-only owner dashboard for
  aggregation). They expose the same group-level rows only — no
  investor-identifiable data.
- The Telegram daily brief (`POST /api/investor/notify/daily-brief`,
  CRON_SECRET-guarded) is composed from the latest summary row plus open
  HIGH/CRITICAL alerts.

## Alert rules (`investor_hermes_alert_log`)

Alerts are created by the same regenerate run, with deterministic IDs
(re-runs never duplicate or re-push). Thresholds are constants in
`src/lib/investor-alerts.ts` (the app has no threshold-config tab):

| Rule | Severity | Condition | ID |
| ---- | -------- | --------- | -- |
| `DIVIDEND_OVERDUE` | HIGH | Dividend `status=declared` and unpaid past due date (declared_at + 30 days payment terms) | `ALR-DIVIDEND_OVERDUE-<dividend_id>` (once per dividend) |
| `CAPITAL_OUTFLOW` | MEDIUM | Same-day capital `out` total > Rp 100.000.000 | `ALR-YYYYMMDD-CAPITAL_OUTFLOW` |
| `data_missing` | LOW | Finance cross-read has no row for the summary date | `ALR-YYYYMMDD-data_missing` |

Only HIGH/CRITICAL alerts are pushed to Telegram (immediate push on
creation + the 22:00 WIB brief); MEDIUM/LOW stay in the log.

## Cadence

- **Daily**: `investor_daily_summary` is regenerated once per day (owner
  runs `POST /api/investor/summary/regenerate`, typically via scheduler),
  after finance has closed its own daily summary — otherwise the
  `data_missing` alert flags the gap. The 22:00 WIB Telegram brief reads
  the latest summary.
- **Monthly statement** (per-investor PDF/statement): *future work* — not
  implemented. Do not promise it to investors until it ships.
