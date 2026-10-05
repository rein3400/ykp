# hr/payroll-payment-validation-ui Specification

## Purpose
Keeps HR's payment validation reachable despite rows being locked by auto-approve, because stamping PAID adds payment evidence rather than editing figures.
## Requirements
### Requirement: Payment actions render on locked unpaid approved rows

The HR payroll table SHALL render "Validasi Pembayaran" and "Tandai Dibayar" for every row with `approval_status=APPROVED` and `payment_status≠PAID`, whether or not the row is LOCKED (auto-approve generate locks rows without unlocking them for payment).

#### Scenario: HR validates payment on an auto-approved locked row

- **WHEN** HR clicks "Validasi Pembayaran" on an `APPROVED + LOCKED + UNPAID` row after Finance transferred
- **THEN** the row becomes `PAID + LOCKED` and the payslip email flow runs — no owner unlock detour is required

