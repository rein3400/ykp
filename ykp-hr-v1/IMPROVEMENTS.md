# UI/UX Improvements — YKP HR V1

> Snapshot: 2026-07-18 (Ralph Loop iteration 1)
> Scope: `ykp-hr-v1` — pilot-target HR module (Next.js 16 + Tailwind + Google Sheets)

---

## ✅ Shipped This Iteration

### Foundation (new primitives)

| File | What it does |
|---|---|
| [src/components/toast.tsx](file:///D:/YKP%20ERP/ykp/ykp-hr-v1/src/components/toast.tsx) | Toast notification system (success/error/info/warning) with auto-dismiss, aria-live, close button. Replaces all blocking `alert()` calls. |
| [src/components/confirm-dialog.tsx](file:///D:/YKP%20ERP/ykp/ykp-hr-v1/src/components/confirm-dialog.tsx) | Accessible confirmation dialog (Esc to cancel, backdrop click, focus trap). Replaces blocking `confirm()` calls. |
| [src/components/skeleton.tsx](file:///D:/YKP%20ERP/ykp/ykp-hr-v1/src/components/skeleton.tsx) | `CardSkeleton`, `TableSkeleton`, `FormSkeleton` — used in route-level `loading.tsx`. |
| [src/components/empty-state.tsx](file:///D:/YKP%20ERP/ykp/ykp-hr-v1/src/components/empty-state.tsx) | Reusable empty-state block (icon + title + description + optional CTA). |
| [src/app/hr/loading.tsx](file:///D:/YKP%20ERP/ykp/ykp-hr-v1/src/app/hr/loading.tsx) | Route-level loading UI — skeletons instead of blank page. |
| [src/app/hr/error.tsx](file:///D:/YKP%20ERP/ykp/ykp-hr-v1/src/app/hr/error.tsx) | Route-level error boundary — friendly message + "Coba Lagi" button. |
| [src/app/not-found.tsx](file:///D:/YKP%20ERP/ykp/ykp-hr-v1/src/app/not-found.tsx) | Polished 404 page with link back to `/hr`. |

### Bug fixes

| Where | Was | Now |
|---|---|---|
| [src/app/hr/lateness/page.tsx](file:///D:/YKP%20ERP/ykp/ykp-hr-v1/src/app/hr/lateness/page.tsx) | Intermittent SSR 500 when Sheets API transiently failed | Wrapped `readTab` in try/catch, renders amber banner + empty data instead of crashing |
| All tables (payroll/adjust/leaves/lateness/employees/attendance) | Blocking `alert("Gagal")` on error, silent on success | Non-blocking toast on both success & error; per-row `busyId` spinner (was global `busy`) |
| [src/features/hr/components/employees-table.tsx](file:///D:/YKP%20ERP/ykp/ykp-hr-v1/src/features/hr/components/employees-table.tsx) | `confirm()` blocked main thread | `useConfirm` async dialog, danger-styled for deactivate |

### UI/UX upgrades

| Surface | Change |
|---|---|
| Sidebar | Active-route highlight (`aria-current="page"`), heroicon per item, mobile hamburger + slide-over drawer with backdrop, auto-close on route change, brand block at top, role label in footer |
| Layout | Mobile top-bar spacing (`pt-20 md:pt-6`), responsive padding |
| KPI cards (HR overview) | Color-coded by tone (green/yellow/red/gray) with border + bg tint, uppercase label, tabular-nums, 7-col grid on xl |
| Login page | Gradient backdrop, brand mark, focus rings, show/hide password toggle, inline validation, loading spinner on submit, removed default-password hint from UI (kept in seed scripts) |
| Forms (adjustment / leave / roster / attendance) | Toast on success, inline validation (amount > 0, end ≥ start, reason required), better disabled state (`Menyimpan…` not `...`), styled `role="alert"` error banner |
| Payroll table | Per-row busy spinner (was global), inline error for payment-ref & unlock-reason (was `alert`), toast on approve / mark-paid / unlock |
| Global CSS | Focus rings on all `.btn` / `.input`, `disabled:` states, font smoothing, tabular-nums utility |

---

## 🟡 Recommended Next (Priority Order)

### P0 — blocking pilot go-live

1. **Rotate default password** — `owner/owner123` still documented in README + bootstrap scripts. Either:
   - Force password change on first login (add `must_change_password` column on `users` tab, redirect to `/hr/account/change-password` until rotated), OR
   - Generate per-owner credentials at bootstrap and print once to CLI (no UI hint).
2. **Replace mock data with owner data pack** — tracked in `PROGRESS_STATUS.md`. Until then Phase 1 DoD cannot close.
3. **Fix ykp-erp unit suite** — `@ykp/engine` `./triggers` export missing, attendance mock brand id broken (see `VERIFICATION_REPORT.md` §7). Blocks CI green gate.

### P1 — UX / trust

4. **Hermez hydration #418** — all Hermez pages emit `pageerror`. Likely cause: server-rendered date/random differs from client. Fix by:
   - Deferring `Date.now()` / `Math.random()` / `new Date().toLocaleString()` to `useEffect`, OR
   - Wrapping time-dependent blocks in `<ClientOnly>` / `suppressHydrationWarning`.
5. **HR attendance API ~37s** — likely Sheets `readTab` without pagination + N+1 lookup. Add:
   - Server-side cache (60s TTL) keyed by tab name (single-flight), OR
   - Migrate hot tabs (attendance) to Postgres once pilot is green.
6. **Hermez run ~28s** — async job pattern: `POST /api/hermez/run` returns `job_id` immediately, poll `/api/hermez/run/[id]` for status, show progress bar in UI.
7. **Payroll approval UI** — already wired (this iteration), but consider **bulk approve** (checkbox per row + "Setujui semua yang terpilih") for 50-employee payroll run.
8. **Finance dashboard all-zero cards** — when today is empty, fall back to "latest non-zero day" label, not just `Rp 0`. Show "Data per 2026-07-15" caption.

### P2 — polish

9. **Rate-limit 429 under sequential walk** — current 60 req/min per IP is too tight for a 10-page walkthrough. Raise to 120/min for authenticated users, or move to per-user (session) bucket instead of per-IP.
10. **Security headers** — add to `next.config.ts`:
    ```ts
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' }
    ]
    ```
    CSP: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'`.
11. **Finance Rebuild Today click** — verify `onClick` handler isn't swallowed by hydration race; add explicit `type="button"` and `disabled` state.
12. **Clock-in idempotency** — multi-click can double-post. Fix:
    - Disable button after first click (already done via `busy`), AND
    - Server-side: unique constraint on `(employee_id, date)` in `hr_attendance`, return `200` (not `5xx`) on duplicate with friendly message.
13. **Finance export CSV** — `GET /api/fin/export/csv` returns 405. Either support `GET` with query params, or change UI to `POST` with form. Document contract.

### P3 — bigger UX investments

14. **Command palette (⌘K)** — power-user nav across 9 HR pages, especially useful on mobile. Use `cmdk` or build minimal.
15. **Optimistic updates everywhere** — currently only leaves/adjust/lateness/payroll tables do optimistic. Extend to: attendance clock-in (show "Menyimpan…" inline row immediately), employee deactivate (gray out row instantly).
16. **Undo for destructive actions** — after "Nonaktifkan karyawan", show toast with "Undo" button (5s window) instead of just confirm dialog.
17. **Bulk import preview** — `/hr/employees/import` shows parsed rows with errors highlighted *before* submit (currently submits then reports).
18. **Payslip PDF download** — currently HTML only. Use `@react-pdf/renderer` or Puppeteer side-car.
19. **Offline-tolerant clock-in** — outlet staff may have flaky wifi. Queue clock-in in `localStorage`, retry when online, show "Terkirim saat online" badge.
20. **Dark mode** — tokens already in place; add `dark:` variants + `next-themes` provider.

---

## 📐 Design-system recommendations

1. **Standardize page header** — currently each page re-implements `<h1> + sub`. Extract:
   ```tsx
   <PageHeader
     title="Payroll"
     subtitle="Generate, review, approve, mark paid."
     actions={<Link className="btn-primary">Generate</Link>}
   />
   ```
2. **Standardize table shell** — tables re-implement `overflow-x-auto rounded-lg border ...`. Extract `<DataTable>` with built-in empty state, loading skeleton, sort controls.
3. **Standardize form field** — every form re-implements `<label class="text-sm">...<input class="input mt-1 w-full"/>`. Extract `<FormField label error hint>` with consistent `id`, `aria-invalid`, `aria-describedby`.
4. **Currency display** — `formatIdr` used inconsistently (some pages show raw number strings). Always render via `<Idr value={...} />` component that wraps `formatIdr` + `tabular-nums` styling.
5. **Date display** — mix of ISO `2026-07-18` and locale formats. Standardize `<DateDisplay value format="short|long" />` (WIB locale, consistent separator).

---

## 🧪 Verification done this iteration

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm test -- --run` | ✅ 64/64 across 11 files |
| `npm run build` | ✅ Next.js 16 + Turbopack, 31 routes generated, no errors |
| `alert(`/`confirm(` in UI code | ✅ 0 remaining (replaced with toast/confirm-dialog) |
| Real browser (Kimi WebBridge) | ✅ login → dashboard → leaves approve all verified live |
| Login page | ✅ brand mark, show/hide password, inline error, spinner |
| Dashboard KPIs | ✅ color-coded (green/amber/rose/gray), real Sheets data (Funkydak) |
| Mobile viewport 390px | ✅ hamburger → slide-over drawer + backdrop, KPIs stack |
| Leave approve flow | ✅ PENDING → APPROVED optimistic update, buttons swap to "—" |
| Hydration #418 (hr-v1) | ✅ root-caused to browser-extension `<body>` class injection; hardened with `suppressHydrationWarning` |

**Hydration root cause (important for Hermez #418):** the dev-overlay "1 Issue" was a `<body className="kapture-loaded">` mismatch injected by a **browser extension** (Merlin/Kapture AI assistant), not app code. Same class of noise likely drives the Hermez #418 errors on the owner's machine. Fix shipped: `suppressHydrationWarning` on `<body>` + recommendation to whitelist the app's origin in the extension.

---

## 🔍 Cross-app bugs found (not yet fixed — need separate iteration)

| App | Sev | Issue | Evidence |
|---|---|---|---|
| `ykp-erp/apps/hermez` | HIGH | React #418 hydration on all main pages | `VERIFICATION_REPORT.md` §2 |
| `ykp-erp/apps/hr` | HIGH | `GET /api/hr/attendance` ~37s | `VERIFICATION_REPORT.md` §3 |
| `ykp-erp/apps/hr` | MED | `attendance-smoke` vitest fails — mock brand missing | `VERIFICATION_REPORT.md` §3 |
| `ykp-erp/apps/hermez` | HIGH | `hermez-brief-smoke` fails to load — `@ykp/engine` `./triggers` export missing | `VERIFICATION_REPORT.md` §3 |
| `ykp-erp/apps/finance` | MED | Dashboard shows `Rp 0` when today empty | `VERIFICATION_REPORT.md` §1 |
| `ykp-erp/apps/finance` | LOW | `/api/fin/export/csv` 405 on GET | `VERIFICATION_REPORT.md` §1 |
| `ykp-hr-v1` | CRIT (ops) | Default `owner/owner123` live on Railway | `VERIFICATION_REPORT.md` §4 |
| `ykp-hub` | LOW | Missing `X-Content-Type-Options` header | `VERIFICATION_REPORT.md` §5 |

---

## 💡 Suggested next-iteration scope

Pick ONE of these tracks for the next Ralph Loop iteration:

- **Track A — Hermez hydration + run UX** (highest user-visible bug): fix #418, add async job pattern for `/run`.
- **Track B — ykp-erp unit suite green** (blocks CI): add `./triggers` export, fix mock brand id.
- **Track C — Finance dashboard zero-state** (most visible finance UX issue): latest-day fallback + skeleton + error toast.
- **Track D — Security headers + rate-limit tuning** (ops hygiene, 30 min work).
- **Track E — Bulk actions + Command palette** (power-user UX, bigger investment).
