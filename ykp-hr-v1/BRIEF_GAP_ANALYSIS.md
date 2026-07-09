# ykp-hr-v1 — Brief V1 Gap Analysis

Status: 2026-07-09
Source brief: `YKP_ERP_HR_Developer_Brief_V1.txt` (1223 lines)

---

## ✅ Yang SUDAH ada di source

| Brief Section | Status | Detail |
|---|---|---|
| 6.1 HR Overview | ✅ Built | KPI cards, summary tables di `/hr` |
| 6.2 Master Karyawan | ✅ Built | 34 kolom lengkap di `master_employee` tab |
| 6.3 Absensi | ✅ Built | Clock-in/out, status enum (PRESENT/LATE/ABSENT/LEAVE/SICK/OFF/INCOMPLETE/MANUAL_CORRECTION), late_minutes, overtime |
| 6.4 Shift & Roster | ✅ Built | `hr_shift` + `hr_roster` schemas, weekly UI di `/hr/roster` |
| 6.5 Keterlambatan | ✅ Built | `hr_lateness` + `hr_lateness_rules` tabs, calculation methods (NO_PENALTY/FLAT/PER_MINUTE/TIERED/MANUAL_REVIEW) |
| 6.6 Izin/Cuti | ✅ Built | 7 leave types (ANNUAL_LEAVE/SICK/PERMISSION/UNPAID_LEAVE/EMERGENCY/MATERNITY), approval flow |
| 6.7 Payroll | ✅ Built | `hr_payroll` schema, formula support (gross/net salary), payment_status enum |
| 6.8 Bonus/Potongan | ✅ Built | `hr_adjustment` tab, 6 types (BONUS/PENALTY/OVERTIME/ALLOWANCE/CASH_ADVANCE/REIMBURSEMENT) |
| 6.9 Slip Gaji | ✅ Built (basic) | API `/api/hr/payslip/[id]` generates plain text only (brief minta PDF) |
| 7 HR Summary untuk Hermez | ✅ Built | `hr_daily_summary` tab + `/api/hr/summary` + `/api/hr/summary/regenerate` |
| 8 Master Data | ✅ Built | 8 master tabs (brand, outlet, employee, role, shift, payrollRule, latenessRule, leaveType) |
| 9 RBAC | ✅ Built | 9 roles di `src/lib/rbac.ts` (owner, super_admin, hr_admin, finance_admin, brand_manager, outlet_manager, supervisor, employee, viewer) |
| 11 Alert Rules | ⚠️ Partial | `hermes_alert_log` schema exists, generation logic baru handle sebagian rules |

---

## ⚠️ Gap (perlu kerja)

| Item | Detail |
|---|---|
| Sheets bootstrap | `npm run sheets:bootstrap` belum dijalankan (spreadsheet kosong) |
| Seed user | `npm run sheets:seed-user` belum dijalankan |
| Master data seed | Brand (5 brand YKP), outlets, roles, shifts, payroll rules, lateness rules, leave types belum di-insert |
| Approval flow UI | 4 API endpoints exist tapi button UI belum di-wire di list pages |
| Payslip PDF | API generates plain text only, bukan PDF |
| Logout UI | API exists, no UI button |
| Edit/Deactivate employee row actions | Brief minta, belum ada UI |
| HR Overview filters | Brief §6.1 minta filter brand/outlet/period/role/status, UI belum |
| Payment reference tracking | markPaid API ada, no UI button |
| Bank transfer export file | Brief §6.7 minta, no implementation |
| Approval UI wiring (4 flows) | leaves/adjustments/payroll-approve/payroll-mark-paid |

---

## 🚀 Belum ada sama sekali (perlu build dari nol)

| Item | Brief Section |
|---|---|
| Telegram bot untuk absensi | §6.3 |
| QR code absensi | §6.3 |
| GPS radius check (validation logic) | §6.3 (column exists, no validator) |
| PDF payslip generation | §6.9 |
| Shift swap request flow UI | §6.4 (schema support, no UI) |
| Reopen payroll UI | §6.7 (allowed role, no button) |
| Manual correction attendance flow | §6.3 (status enum ada, no UI) |
| Photo upload handler | §6.3 (column exists, no upload) |
| Bank account change approval | §10 |
| Bank transfer file export | §6.7 |
| 11 alert rules (full implementation) | §11 |

---

## Tracks Prioritas

### Track A — Fix ykp-hr-v1 502 + bootstrap Sheets
- Fix Railway proxy issue (re-deploy atau delete+recreate)
- Run `sheets:bootstrap`
- Run `sheets:seed-user` + seed master data
- Verify login + basic flow

### Track B — Wire approval UI
- `/hr/leaves` — approve/reject button per row
- `/hr/adjustments` — approve/reject button per row
- `/hr/payroll` — approve + mark-paid button per row
- Sidebar logout button

### Track C — Missing brief features
- PDF payslip generation
- GPS radius validation
- HR Overview filters
- (other brief gaps)