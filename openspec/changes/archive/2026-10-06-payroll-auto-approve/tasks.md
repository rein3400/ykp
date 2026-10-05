# Tasks — Payroll Auto-Approve

## 1. Core route change (hr-v1)

- [x] 1.1 `ykp-hr-v1/src/app/api/hr/payroll/generate/route.ts`: set `approval_status=APPROVED`, `payment_status=READY_TO_PAY`, `locked_status=LOCKED`, `approved_by=actor`, `approved_at=now (WIB)` on every generated/updated row; keep 409-on-any-locked-period behaviour; keep row-count audit but extend message to note auto-approve
- [x] 1.2 `/api/hr/payroll/approve`: make idempotent for rows already `APPROVED` (200 no-op), keep existing transition for non-approved unlocked rows
- [x] 1.3 `/api/hr/payroll/needs-revision`: accept `LOCKED + not PAID` rows — set `NEEDS_REVISION + UNLOCKED` + mandatory reason; keep 409 for `PAID`; update `needs-revision/route.test.ts` (add locked-unpaid accepted case, PAID rejected case)

## 2. UI (hr-v1)

- [x] 2.1 `src/features/hr/components/payroll-table.tsx`: remove per-row "Setujui" button for non-PENDING rows; render "Setujui" only for legacy `approval_status=PENDING && locked_status!=LOCKED` rows; adjust status chips/copy for auto-approved rows
- [x] 2.2 `src/app/hr/payroll/generate/page.tsx`: fix copy — describe one-click generate (auto-lock + directly visible to Finance) and the real re-generate constraint (blocked while ANY row in the period is LOCKED, owner unlock required)
- [x] 2.3 `ykp-finance-v1/src/app/finance/payroll/payroll-client.tsx`: status chip copy for APPROVED rows ("auto-approve HR") — logic untouched

## 3. Reconcile payroll-hardening change (artifacts only)

- [x] 3.1 Edit `openspec/changes/payroll-hardening/specs/hr/payroll-controls/spec.md`: scope the SoD requirement to adjustments/leaves/lateness approvals and explicitly exclude payroll generate/approve with rationale pointer to `payroll-auto-approve`
- [x] 3.2 Edit `openspec/changes/payroll-hardening/proposal.md` + `tasks.md`: mark/remove the payroll self-approval subtask, note the dependency on this change

## 4. Tests (hr-v1)

- [x] 4.1 Unit/route tests for generate: rows end `APPROVED+READY_TO_PAY+LOCKED`, `approved_by`=actor, audit single event, 409 when period has locked rows
- [x] 4.2 Approve idempotency test (already-APPROVED row returns 200, unchanged)
- [x] 4.3 needs-revision tests for locked-unpaid (accepted, unlock applied) and PAID (409)
- [x] 4.4 `cd ykp-hr-v1 && npm test` + `npm run lint` green; `cd ykp-finance-v1 && npm test` green (payroll-overview PENDING-exclusion case still passes against legacy data)

## 5. Verification & handoff

- [x] 5.1 Manual E2E on dev: hr_admin → /hr/payroll/generate → row APPROVED+LOCKED → Finance /finance/payroll shows row in "HARUS DIBAYAR" → Minta Revisi → row NEEDS_REVISION+UNLOCKED → regenerate re-locks — DONE via hr-v1 dev HTTP (mock DB): generate 2025-06 count=12 semuanya APPROVED+READY_TO_PAY+LOCKED (approved_by=generator USR-002); owner idempotent approve 200 no-op; cross-app Minta Revisi (x-finance-secret) → NEEDS_REVISION+UNLOCKED (dulu dead-end 409); re-generate 409 saat masih ada LOCKED; setelah owner unlock 11 baris (EMP-001 sudah unlocked via revisi), regenerate → semua re-locked APPROVED lagi. Finance "HARUS DIBAYAR" verifikasi diliput oleh unit test payableOf (kontrak shared-tab tak berubah; mock DB tidak bisa meniru baca Sheets lintas-app).
- [x] 5.2 Update DEPLOYED_LINKS.md/PROGRESS.md notes after deploy (post-apply, owner deploy step) — DONE 2026-10-06: deploy branch main @ 88b10de oleh owner; wave summary ditulis ke kedua file