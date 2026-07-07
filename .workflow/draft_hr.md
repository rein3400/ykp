# HR App Migration Blueprint

## 1. master_employee schema

| Column | Type | Required | Notes |
|---|---|---|---|
| employee_id | text / UUID | Y | Unique ID, stable across systems |
| full_name | text | Y | Display name |
| role | text | Y | e.g. barista, cook, supervisor, manager |
| outlet_id | text | Y | FK to master_outlet |
| brand_id | text | Y | Denormalized for summary filters |
| phone | text | N | WhatsApp / SMS contact |
| telegram_id | text | N | For Hermez alert routing |
| employment_type | text | Y | full_time / part_time / contract |
| join_date | date | Y | Payroll prorate baseline |
| base_salary | number | Y | Monthly gross (Rp) |
| status | text | Y | active / inactive / terminated |

## 2. master_outlet mapping

| Column | Type | Required | Notes |
|---|---|---|---|
| outlet_id | text | Y | Unique ID |
| brand_id | text | Y | FK to master_brand |
| outlet_name | text | Y | Display name |
| location | text | N | City / address |
| timezone | text | Y | Default Asia/Jakarta |
| opening_time | time | N | Earliest shift start |
| closing_time | time | N | Latest shift end |
| status | text | Y | active / closed / test |

**Mapping rule**: every `employee.outlet_id` must exist in `master_outlet.outlet_id`. One employee maps to exactly one outlet at a time; multi-outlet staff need a primary outlet + secondary assignment log.

## 3. hr_rules schema

| Column | Type | Required | Notes |
|---|---|---|---|
| rule_id | text | Y | Unique ID |
| outlet_id | text | Y | Rule scope |
| shift_name | text | Y | morning / afternoon / full_day |
| shift_start | time | Y | Expected check-in |
| shift_end | time | Y | Expected check-out |
| late_tolerance_minutes | int | Y | e.g. 10 |
| overtime_rate_multiplier | number | Y | e.g. 1.5 for first 4h, 2.0 after |
| overtime_daily_cap_hours | number | N | e.g. 4 |
| early_clockin_tolerance_min | int | N | Prevent gaming the clock |
| mandatory_checkout | boolean | Y | true requires end-of-day check-out |
| payroll_period_start | int | Y | 1–31 day of month |
| payroll_period_end | int | Y | e.g. 31 |

## 4. hr_attendance schema

| Column | Type | Required | Notes |
|---|---|---|---|
| attendance_id | text | Y | Unique ID |
| date | date | Y | Work date (Asia/Jakarta) |
| employee_id | text | Y | FK to master_employee |
| outlet_id | text | Y | Outlet worked |
| shift_name | text | Y | FK to hr_rules.shift_name |
| check_in | datetime | Y | Actual check-in |
| check_out | datetime | N | Missing = open attendance |
| check_in_location | text | N | Optional geotag |
| check_out_location | text | N | Optional geotag |
| is_late | boolean | Y | Computed from rule |
| late_minutes | int | N | 0 if on time |
| is_early_leave | boolean | N | True if check_out < shift_end |
| overtime_hours | number | N | Computed from rule |
| attendance_status | text | Y | present / absent / izin / sakit / cuti |
| approved_by | text | N | Manager/supervisor ID |
| notes | text | N | Free text |

## 5. Payroll calculation formulas

**Base period definition**

```
payroll_days = DATEDIFF(payroll_period_start, payroll_period_end) + 1
```

**Daily prorated salary**

```
daily_rate = base_salary / payroll_days
```

**Attendance proration**

```
attendance_count = COUNT(hr_attendance WHERE employee_id = X
                                          AND date IN period
                                          AND status IN ('present','izin','sakit'))
absent_days      = payroll_days - attendance_count
attendance_deduction = absent_days * daily_rate
```

**Late deduction (configurable per outlet)**

```
late_deduction = IF(late_minutes_total_in_period > 60,
                    FLOOR(late_minutes_total / 60) * hourly_late_penalty,
                    0)
```

**Overtime pay**

```
regular_hourly_rate  = base_salary / (payroll_days * shift_hours)
overtime_first_block = MIN(overtime_hours, 4) * regular_hourly_rate * 1.5
overtime_next_block  = MAX(overtime_hours - 4, 0) * regular_hourly_rate * 2.0
overtime_pay         = overtime_first_block + overtime_next_block
```

**Gross salary**

```
gross_salary = (attendance_count * daily_rate)
               + overtime_pay
               + bonus
               - attendance_deduction
               - late_deduction
               - other_deductions
```

**Net salary estimate**

```
net_salary = gross_salary - (gross_salary * tax_estimate_pct) - employee_benefits
```

### Example: Barista “Ayu” at outlet YKP_Kemang_01

| Item | Value |
|---|---|
| Base salary | Rp 4,500,000 |
| Payroll period | 1–30 Jun 2026 (30 days) |
| Daily rate | Rp 150,000 |
| Present days | 26 |
| Izin (paid) | 2 |
| Absent | 2 |
| Total late minutes | 75 |
| Hourly late penalty | Rp 18,750 |
| Overtime hours | 5 |
| Regular shift hours | 8 |
| Hourly rate | Rp 18,750 |
| Bonus | Rp 250,000 |

| Calculation | Amount |
|---|---|
| Attendance base | 28 × Rp 150,000 = Rp 4,200,000 |
| Absent deduction | 2 × Rp 150,000 = -Rp 300,000 |
| Late deduction | 75 min = 1.25h → 1h × Rp 18,750 = -Rp 18,750 |
| Overtime pay | (4 × Rp 18,750 × 1.5) + (1 × Rp 18,750 × 2.0) = Rp 150,000 |
| Bonus | +Rp 250,000 |
| **Gross salary** | **Rp 4,281,250** |

## 6. Step-by-step migration task list

| Step | Task | Owner | Verification |
|---|---|---|---|
| 1 | Clone HR app to YKP testing environment | Dev | App loads with no live data |
| 2 | Connect app to YKP_HR_DATABASE or YKP_CENTRAL_DATABASE HR tab | Dev | App reads/writes new spreadsheet |
| 3 | Fill master_brand and master_outlet for all YKP brands/outlets | Data | No orphan employees |
| 4 | Fill master_employee with current roster | Data | 1:1 match with existing payroll list |
| 5 | Configure hr_rules per outlet (shift, tolerance, overtime, period) | Ops + Dev | Rules visible in app admin panel |
| 6 | Test attendance: check-in, check-out, late, izin, missing checkout | QA | All statuses computed correctly |
| 7 | Test payroll on 3–5 sample employees | QA + Finance | Compare to manual spreadsheet |
| 8 | Reconcile mismatches and adjust formulas/config | Dev | Variance ≤ Rp 1,000 per employee |
| 9 | Pilot 1 outlet for 7 days with real staff | Ops | Daily attendance closes cleanly |
| 10 | Rollout to remaining outlets | Ops + Dev | Each outlet passes 1-day smoke test |

## 7. Validation checklist

| # | Check | Pass criteria |
|---|---|---|
| 1 | Schema validation | master_employee, master_outlet, hr_rules, hr_attendance exist and all required columns populated |
| 2 | Referential integrity | Every employee has valid outlet_id and brand_id |
| 3 | Shift rule coverage | Every active outlet has at least one shift rule |
| 4 | Attendance closure | No open check-out older than 48 hours at end of day |
| 5 | Late detection | Late flagged within tolerance and minutes counted |
| 6 | Overtime math | Overtime hours match clock-out minus shift_end, capped by rule |
| 7 | Payroll reconciliation | App gross == manual gross for 3–5 sample employees |
| 8 | Summary output | hr_daily_summary populated with correct staff counts |
| 9 | Pilot sign-off | Outlet manager confirms numbers match reality for 7 days |
| 10 | Backup before rollout | Snapshot of YKP_HR_DATABASE taken and stored |

## 8. Common failure modes

| Failure | Likely cause | Fix |
|---|---|---|
| Clock-in recorded on wrong date | Timezone set to UTC instead of Asia/Jakarta | Force Asia/Jakarta in app and database |
| Missing checkout flagged as present | `mandatory_checkout=false` or missing rule | Set mandatory_checkout=true per outlet |
| Payroll variance > Rp 10,000 | Wrong payroll_days or prorate formula | Reconcile period length and daily_rate |
| Overtime not calculated | `shift_end` or `overtime_rate_multiplier` empty | Audit hr_rules completeness |
| Employee appears at wrong outlet | master_outlet.outlet_id mismatch | Use master_outlet as single source of truth |
| Summary shows duplicate staff | employee_id not unique or rehired with same phone | Add unique constraint on employee_id |
| Late tolerance ignored | Rule not linked to outlet/shift combination | Add composite key (outlet_id, shift_name) |
| Rollout breaks existing pilot | Production database still points to test sheet | Use environment-specific spreadsheet IDs |
| Hermez reads stale data | hr_daily_summary not refreshed after attendance close | Schedule daily close + summary refresh job |
