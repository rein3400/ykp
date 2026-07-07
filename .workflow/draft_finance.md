# Finance App Migration — Technical Blueprint

## 1. Objective

Migrate the existing Finance Web App from its dummy/demo environment into a YKP-dedicated environment, connect it to the YKP Finance database, and validate dashboard numbers against Moka/manual sources before piloting at one brand/outlet.

## 2. Master Data Schemas

### 2.1 `master_brand`

| Column | Type | Description |
|--------|------|-------------|
| `brand_id` | string / UUID | Unique brand identifier. |
| `brand_name` | string | Display name of the brand. |
| `status` | enum: active / inactive | Whether the brand is operational. |
| `created_at` | timestamp | Record creation time. |
| `updated_at` | timestamp | Last update time. |

### 2.2 `master_outlet`

| Column | Type | Description |
|--------|------|-------------|
| `outlet_id` | string / UUID | Unique outlet identifier. |
| `brand_id` | FK → `master_brand.brand_id` | Parent brand. |
| `outlet_name` | string | Display name of the outlet. |
| `location` | string | Address or area label. |
| `status` | enum: active / inactive | Outlet operational flag. |
| `created_at` | timestamp | Record creation time. |
| `updated_at` | timestamp | Last update time. |

### 2.3 `master_supplier`

| Column | Type | Description |
|--------|------|-------------|
| `supplier_id` | string / UUID | Unique supplier identifier. |
| `supplier_name` | string | Supplier display name. |
| `category` | string | Ingredient, packaging, logistics, etc. |
| `contact` | string | Phone or email. |
| `bank_account` | string | Optional account details. |
| `status` | enum: active / inactive | Whether supplier is still used. |
| `created_at` | timestamp | Record creation time. |
| `updated_at` | timestamp | Last update time. |

### 2.4 Finance Categories

#### 2.4.1 `fin_expense_category`

| Column | Type | Description |
|--------|------|-------------|
| `category_id` | string / UUID | Unique category identifier. |
| `category_name` | string | Human-readable name (electricity, rent, marketing, etc.). |
| `account_type` | enum: OPEX / CAPEX / COGS / OTHER | Grouping for P&L. |
| `status` | enum: active / inactive | Operational flag. |

#### 2.4.2 `fin_payment_method`

| Column | Type | Description |
|--------|------|-------------|
| `method_id` | string / UUID | Unique method identifier. |
| `method_name` | string | Cash, debit card, QRIS, transfer, etc. |
| `is_cash` | boolean | True if method affects physical cash count. |
| `status` | enum: active / inactive | Operational flag. |

#### 2.4.3 `fin_petty_cash_account`

| Column | Type | Description |
|--------|------|-------------|
| `account_id` | string / UUID | Unique petty-cash account identifier. |
| `outlet_id` | FK → `master_outlet.outlet_id` | Outlet the cash belongs to. |
| `account_name` | string | Label (e.g., "Petty Cash — Outlet A"). |
| `currency` | string | Default `IDR`. |
| `status` | enum: active / inactive | Operational flag. |

### 2.5 `fin_opening_balance`

| Column | Type | Description |
|--------|------|-------------|
| `balance_id` | string / UUID | Unique balance record identifier. |
| `outlet_id` | FK → `master_outlet.outlet_id` | Outlet scope. |
| `effective_date` | date | Date the balance applies. |
| `cash_balance` | decimal | Cash-on-hand starting balance. |
| `petty_cash_balance` | decimal | Petty cash starting balance. |
| `unpaid_supplier_opening` | decimal | Supplier debt carried forward. |
| `receivable_opening` | decimal | Optional customer receivables. |
| `notes` | text | Supporting notes / evidence references. |
| `recorded_by` | string | PIC / user who entered it. |
| `created_at` | timestamp | Record creation time. |

## 3. Transaction Schemas

### 3.1 `fin_pos_daily`

| Column | Type | Description |
|--------|------|-------------|
| `pos_id` | string / UUID | Unique daily record identifier. |
| `date` | date | Transaction date. |
| `brand_id` | FK → `master_brand.brand_id` | Brand scope. |
| `outlet_id` | FK → `master_outlet.outlet_id` | Outlet scope. |
| `gross_sales` | decimal | Total gross sales before discounts/refunds. |
| `net_sales` | decimal | Gross sales minus discounts and refunds. |
| `transaction_count` | integer | Number of transactions. |
| `discount_total` | decimal | Total discounts applied. |
| `refund_total` | decimal | Total refunds. |
| `payment_method_breakdown` | JSON / sub-table | Optional per-method split. |
| `source` | enum: Moka / manual / import | Origin of the data. |
| `imported_at` | timestamp | When the row was imported. |
| `verified_by` | string | PIC who validated the numbers. |

### 3.2 `fin_supplier_cost`

| Column | Type | Description |
|--------|------|-------------|
| `cost_id` | string / UUID | Unique cost record identifier. |
| `date` | date | Invoice or transaction date. |
| `supplier_id` | FK → `master_supplier.supplier_id` | Supplier reference. |
| `brand_id` | FK → `master_brand.brand_id` | Brand scope. |
| `outlet_id` | FK → `master_outlet.outlet_id` | Outlet scope if applicable. |
| `invoice_number` | string | Supplier invoice / nota number. |
| `amount` | decimal | Total supplier cost. |
| `paid_amount` | decimal | Amount already paid. |
| `unpaid_amount` | decimal | `amount - paid_amount`. |
| `due_date` | date | Payment due date. |
| `status` | enum: paid / partial / unpaid | Payment state. |
| `attachment_url` | string | Link to nota/invoice image. |
| `recorded_by` | string | PIC. |
| `created_at` | timestamp | Record creation time. |

### 3.3 `fin_petty_cash`

| Column | Type | Description |
|--------|------|-------------|
| `pc_id` | string / UUID | Unique transaction identifier. |
| `date` | date | Transaction date. |
| `outlet_id` | FK → `master_outlet.outlet_id` | Outlet scope. |
| `account_id` | FK → `fin_petty_cash_account.account_id` | Petty-cash account. |
| `type` | enum: in / out | Direction of cash movement. |
| `amount` | decimal | Transaction amount (always positive). |
| `category_id` | FK → `fin_expense_category.category_id` | Expense category. |
| `description` | text | What the cash was used for. |
| `attachment_url` | string | Optional nota/photo evidence. |
| `recorded_by` | string | PIC. |
| `created_at` | timestamp | Record creation time. |

### 3.4 `fin_expense`

| Column | Type | Description |
|--------|------|-------------|
| `expense_id` | string / UUID | Unique expense identifier. |
| `date` | date | Expense date. |
| `brand_id` | FK → `master_brand.brand_id` | Brand scope. |
| `outlet_id` | FK → `master_outlet.outlet_id` | Outlet scope. |
| `category_id` | FK → `fin_expense_category.category_id` | Expense category. |
| `amount` | decimal | Expense amount. |
| `payment_method_id` | FK → `fin_payment_method.method_id` | How it was paid. |
| `description` | text | Supporting details. |
| `attachment_url` | string | Nota/receipt image. |
| `recorded_by` | string | PIC. |
| `created_at` | timestamp | Record creation time. |

## 4. Dashboard Formulas

| Metric | Formula | Source Tables |
|--------|---------|---------------|
| **Revenue** | `SUM(net_sales)` for selected date/brand/outlet | `fin_pos_daily` |
| **Expense** | `SUM(amount)` where `payment_method` is recorded in `fin_expense` | `fin_expense` |
| **Supplier Cost** | `SUM(amount)` for the period in `fin_supplier_cost` | `fin_supplier_cost` |
| **Petty Cash Out** | `SUM(amount)` from `fin_petty_cash` where `type = 'out'` | `fin_petty_cash` |
| **Unpaid Supplier** | `SUM(unpaid_amount)` where `status != 'paid'` | `fin_supplier_cost` |
| **Cash Difference** | `(opening_cash + cash_revenue_in - cash_expense_out - petty_cash_out) - physical_cash_count` | `fin_opening_balance`, `fin_pos_daily` (cash methods), `fin_expense`, `fin_petty_cash`, closing count |
| **Net Profit Estimate** | `Revenue - Expense - Supplier Cost - Petty Cash Out` | All of the above |

Notes:
- Cash-revenue-in should be derived from the payment-method breakdown of `fin_pos_daily` for methods where `is_cash = true`.
- Cash-expense-out should be derived from `fin_expense` for payment methods where `is_cash = true`.
- Physical cash count is entered at daily closing and is not stored in the schemas above; the difference formula relies on an additional closing-cash input.

## 5. Migration Task List

| # | Task | Owner | Output / Gate |
|---|------|-------|---------------|
| 1 | Clone Finance app to YKP testing environment | DevOps / Developer | Separate app instance with no production impact. |
| 2 | Connect cloned app to `YKP_FINANCE_DATABASE` or Finance tabs in `YKP_CENTRAL_DATABASE` | Backend Developer | Verified read/write connection. |
| 3 | Remove or detach all dummy/demo data from the cloned instance | Backend Developer | No dummy brand/outlet/supplier/transaction remains. |
| 4 | Fill master data: brand, outlet, supplier, finance categories, payment methods, petty-cash accounts | Data / Operations | Master sheets fully populated and cross-referenced. |
| 5 | Enter opening balances: cash, petty cash, supplier debt, receivables | Finance / Operations | Signed-off opening balances per outlet. |
| 6 | Import sample POS data from Moka for 3–7 days | Backend / Data | `fin_pos_daily` rows match Moka report. |
| 7 | Input sample supplier costing, petty cash, and expense transactions with notas | Operations / Finance | All sample rows have evidence links. |
| 8 | Validate dashboard formulas: revenue, expense, supplier cost, petty cash, unpaid supplier, cash difference, net profit | QA / Finance | Variance vs. manual calculation within tolerance. |
| 9 | Pilot finance live for 1 brand / 1 outlet for 7 days | Operations | Daily validation passes; issues logged and fixed. |
| 10 | Prepare `fin_daily_summary` for Hermez consumption | Backend Developer | Summary sheet contract satisfied. |

## 6. Daily Validation Against Moka / Manual Records

| Step | Action | Evidence / Tolerance |
|------|--------|---------------------|
| 1 | Export Moka daily sales report (gross sales, net sales, transaction count, discounts, refunds). | Source file from Moka dashboard. |
| 2 | Compare each row in `fin_pos_daily` to the Moka report for the same `date` + `outlet_id`. | Allowable variance ≤ 1% or Rp 10,000, whichever is larger. |
| 3 | Reconcile supplier invoices against `fin_supplier_cost` `amount` and `unpaid_amount`. | Match invoice number + photo evidence. |
| 4 | Count physical petty cash and compare with `(opening_petty_cash + petty_cash_in - petty_cash_out)`. | Variance ≤ Rp 5,000 or must be explained. |
| 5 | Count physical cash register and compare with cash formula. | Variance = cash_difference column. |
| 6 | Spot-check `fin_expense` rows against saved notas/photos. | 100% of sample rows must have attachments. |
| 7 | Run dashboard formulas and compare net profit estimate to a manually reconstructed P&L. | Variance ≤ 2%. |
| 8 | If any step fails, stop rollout, log the mismatch, fix root cause, and re-validate. | Pass gate before continuing. |

## 7. `fin_daily_summary` Contract for Hermez

| Column | Type | Description |
|--------|------|-------------|
| `date` | date | Summary date. |
| `brand` | string | Brand name from `master_brand.brand_name`. |
| `outlet` | string | Outlet name from `master_outlet.outlet_name`. |
| `revenue` | decimal | `SUM(net_sales)` from `fin_pos_daily`. |
| `expense` | decimal | `SUM(amount)` from `fin_expense`. |
| `supplier_cost` | decimal | `SUM(amount)` from `fin_supplier_cost`. |
| `petty_cash_out` | decimal | `SUM(amount)` from `fin_petty_cash` where `type = 'out'`. |
| `unpaid_supplier` | decimal | `SUM(unpaid_amount)` from `fin_supplier_cost` where `status != 'paid'`. |
| `cash_difference` | decimal | Calculated from opening cash, cash-ins, cash-outs, and physical closing count. |
| `net_profit_estimate` | decimal | `revenue - expense - supplier_cost - petty_cash_out`. |
| `major_finance_issue` | string | Flagged issue if variance exceeds threshold. |
| `recommended_action` | string | Suggested owner/manager action. |

## 8. Rollout Gate

Finance App migration is considered done when:
- Cloned app runs against YKP data with no dummy records.
- Dashboard numbers match Moka/manual sources within the tolerances above.
- 7-day pilot at one brand/outlet completes with no unresolved cash differences or supplier mismatches.
- `fin_daily_summary` is produced daily and readable by Hermez.
- Backup of pre-migration and pre-rollout database/spreadsheet exists.
