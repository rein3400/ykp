# Payslip PDF Attachment — Delta Spec

## Purpose

Delivers the formal salary slip as a neat PDF file attachment (client expectation: "lampiran file formal slip gaji diterima rapi") in addition to the inline HTML preview.

## ADDED Requirements

### Requirement: Payslip email carries a PDF attachment

When the payslip email is sent with real SMTP, the message SHALL include a PDF attachment named `Slip-Gaji-<periode>-<nama karyawan>.pdf` containing the formal slip (brand header, employee/period identity, earnings/deductions table, gross/net, payment reference when present). The attachment SHALL be generated server-side from the same computed payroll row shown in the app. When SMTP is unconfigured the mock path stays as-is (no attachment needed).

#### Scenario: HR validates payment and employee receives PDF slip

- **WHEN** HR runs "Validasi Pembayaran" for an employee with an email address and configured SMTP
- **THEN** the sent email contains the slip inline (HTML) plus the PDF attachment, and the audit log records `payslip_email:<status>`