## 1. Preconditions (read-only verification)

- [ ] 1.1 Verify `created_by` is populated on `hr_leave_request`, `hr_adjustment`, `hr_lateness`, `hr_payroll` tabs (fail closed if missing)
- [ ] 1.2 Confirm `approve` vs `mark_paid` role split in `ykp-hr-v1/src/lib/rbac.ts` (approver != payer evidence)

## 2. SoD guards (spec: separation of duties)

- [ ] 2.1 Add self-approval guard to `leaves/approve` (reject APPROVE on own request, allow REJECT, audit the attempt)
- [ ] 2.2 Add self-approval guard to `adjustments/approve` (same semantics)
- [ ] 2.3 Add self-approval guard to `lateness/approve` (same semantics)
- [ ] 2.4 Add self-approval guard to `payroll/approve` (APPROVE + NEEDS_REVISION denied on self, REJECT allowed)
- [ ] 2.5 Add vitest cases: self-approve rejected, self-reject allowed, other-approve allowed

## 3. Regenerate audit trail (spec: regenerate audit trail)

- [ ] 3.1 Log per-row before/after (net/gross) in `payroll/generate` overwrite path
- [ ] 3.2 Verify approver can see figure history (audit view or payroll detail)

## 4. Transfer reconciliation (spec: transfer reconciliation + bulk confirmation)

- [ ] 4.1 Add `transferred_amount` + `transfer_verified` columns to `hr_payroll` headers (append-only)
- [ ] 4.2 Accept optional per-row amounts in `finance-notify`; compute mismatch flag vs approved net
- [ ] 4.3 Return row count + summed approved net for confirmation before bulk stamp
- [ ] 4.4 Surface mismatch/unverified state in payroll UI

## 5. Honesty + notifications (spec: scope-honesty + email retry)

- [ ] 5.1 Show "belum termasuk BPJS/pajak" notice on payroll approve UI and payslip (text + email)
- [ ] 5.2 Add payslip email resend action for FAILED deliveries + audit entry

## 6. Verification

- [ ] 6.1 `npx tsc --noEmit` clean in ykp-hr-v1
- [ ] 6.2 `npm test` green (new SoD cases included)
- [ ] 6.3 Manual walkthrough: request -> self-approve (403) -> other-approve -> lock -> unlock paths
- [ ] 6.4 `openspec validate --change payroll-hardening`
