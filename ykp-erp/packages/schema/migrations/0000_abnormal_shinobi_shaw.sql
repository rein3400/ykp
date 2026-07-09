CREATE TYPE "master"."expense_account_type" AS ENUM('OPEX', 'CAPEX', 'COGS', 'OTHER');--> statement-breakpoint
CREATE TYPE "master"."user_role" AS ENUM('OWNER', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'HR_ADMIN', 'BRAND_MANAGER', 'OUTLET_MANAGER', 'STAFF_INPUT', 'VIEWER');--> statement-breakpoint
CREATE TYPE "hr"."approval_status" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "hr"."attendance_status" AS ENUM('present', 'absent', 'izin', 'sakit', 'cuti');--> statement-breakpoint
CREATE TYPE "hr"."payroll_line_sign" AS ENUM('plus', 'minus');--> statement-breakpoint
CREATE TYPE "finance"."finance_approval_status" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "finance"."payment_status" AS ENUM('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "finance"."petty_cash_type" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "finance"."pos_source" AS ENUM('moka', 'manual', 'import', 'receipt');--> statement-breakpoint
CREATE TYPE "hermez"."hermez_alert_level" AS ENUM('green', 'yellow', 'red');--> statement-breakpoint
CREATE TYPE "hermez"."hermez_alert_severity" AS ENUM('warning', 'critical');--> statement-breakpoint
CREATE TYPE "hermez"."hermez_alert_source_app" AS ENUM('hr', 'finance', 'ops');--> statement-breakpoint
CREATE TYPE "hermez"."hermez_alert_status" AS ENUM('open', 'ack', 'resolved');--> statement-breakpoint
CREATE TYPE "hermez"."hermez_alert_type" AS ENUM('late_staff', 'cash_diff', 'supplier_overdue', 'petty_cash_anomaly', 'high_expense', 'schema_mismatch', 'data_missing');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master"."fin_expense_category" (
	"category_id" text PRIMARY KEY NOT NULL,
	"category_name" text NOT NULL,
	"account_type" "master"."expense_account_type" NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master"."fin_payment_method" (
	"method_id" text PRIMARY KEY NOT NULL,
	"method_name" text NOT NULL,
	"is_cash" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master"."fin_petty_cash_account" (
	"account_id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"account_name" text NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master"."hr_rules" (
	"rule_id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"shift_name" text NOT NULL,
	"shift_start" text NOT NULL,
	"shift_end" text NOT NULL,
	"late_tolerance_minutes" integer DEFAULT 15 NOT NULL,
	"overtime_rate_multiplier" numeric(5, 2) DEFAULT '1.5' NOT NULL,
	"overtime_daily_cap_hours" numeric(4, 2) DEFAULT '4' NOT NULL,
	"first_block_hours" integer DEFAULT 1 NOT NULL,
	"early_clockin_tolerance_min" integer DEFAULT 30 NOT NULL,
	"mandatory_checkout" boolean DEFAULT true NOT NULL,
	"payroll_period_start" integer NOT NULL,
	"payroll_period_end" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master"."audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master"."master_brand" (
	"brand_id" text PRIMARY KEY NOT NULL,
	"brand_name" text NOT NULL,
	"brand_code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "master_brand_brand_code_unique" UNIQUE("brand_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master"."master_employee" (
	"employee_id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"role" text,
	"department" text,
	"brand_id" text,
	"outlet_id" text,
	"phone" text,
	"telegram_id" text,
	"employment_type" text,
	"join_date" date,
	"base_salary" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master"."master_outlet" (
	"outlet_id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"outlet_name" text NOT NULL,
	"outlet_code" text NOT NULL,
	"address" text,
	"opening_time" text,
	"closing_time" text,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"pic_outlet" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "master_outlet_outlet_code_unique" UNIQUE("outlet_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master"."master_shift" (
	"shift_id" text PRIMARY KEY NOT NULL,
	"shift_name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "master_shift_shift_name_unique" UNIQUE("shift_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master"."master_supplier" (
	"supplier_id" text PRIMARY KEY NOT NULL,
	"supplier_name" text NOT NULL,
	"category" text,
	"contact" text,
	"bank_name" text,
	"bank_account" text,
	"account_holder" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master"."users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "master"."user_role" NOT NULL,
	"outlet_id" text,
	"telegram_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hr"."hr_attendance" (
	"attendance_id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"employee_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"shift_name" text,
	"check_in" timestamp,
	"check_out" timestamp,
	"check_in_location" text,
	"is_late" boolean DEFAULT false NOT NULL,
	"late_minutes" integer DEFAULT 0 NOT NULL,
	"is_early_leave" boolean DEFAULT false NOT NULL,
	"overtime_hours" numeric(5, 2) DEFAULT '0' NOT NULL,
	"attendance_status" "hr"."attendance_status" NOT NULL,
	"approved_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hr"."audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hr"."hr_daily_summary" (
	"summary_id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"brand" text NOT NULL,
	"outlet" text NOT NULL,
	"brand_id" text,
	"outlet_id" text,
	"total_staff" integer DEFAULT 0 NOT NULL,
	"staff_present" integer DEFAULT 0 NOT NULL,
	"staff_late" integer DEFAULT 0 NOT NULL,
	"staff_absent" integer DEFAULT 0 NOT NULL,
	"payroll_issue" text DEFAULT 'none' NOT NULL,
	"major_hr_issue" text DEFAULT 'none' NOT NULL,
	"recommended_action" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hr_daily_summary_date_outlet_unique" UNIQUE("date","outlet")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hr"."hr_payroll" (
	"payroll_id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"payroll_days" integer NOT NULL,
	"attendance_count" integer DEFAULT 0 NOT NULL,
	"absent_days" integer DEFAULT 0 NOT NULL,
	"daily_rate" integer DEFAULT 0 NOT NULL,
	"hourly_rate" integer DEFAULT 0 NOT NULL,
	"regular_hourly_rate" integer DEFAULT 0 NOT NULL,
	"attendance_base" integer DEFAULT 0 NOT NULL,
	"attendance_deduction" integer DEFAULT 0 NOT NULL,
	"late_deduction" integer DEFAULT 0 NOT NULL,
	"other_deductions" integer DEFAULT 0 NOT NULL,
	"overtime_hours" numeric(6, 2) DEFAULT '0' NOT NULL,
	"overtime_first_block" integer DEFAULT 0 NOT NULL,
	"overtime_next_block" integer DEFAULT 0 NOT NULL,
	"overtime_pay" integer DEFAULT 0 NOT NULL,
	"bonus" integer DEFAULT 0 NOT NULL,
	"tax_estimate_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"gross_salary" integer DEFAULT 0 NOT NULL,
	"net_salary" integer DEFAULT 0 NOT NULL,
	"approved_by" text,
	"approval_status" "hr"."approval_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hr"."hr_payroll_line" (
	"line_id" text PRIMARY KEY NOT NULL,
	"payroll_id" text NOT NULL,
	"label" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"sign" "hr"."payroll_line_sign" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance"."fin_closing_cash" (
	"closing_id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"outlet_id" text NOT NULL,
	"physical_cash" integer DEFAULT 0 NOT NULL,
	"opening_cash" integer DEFAULT 0 NOT NULL,
	"pos_cash_sales" integer DEFAULT 0 NOT NULL,
	"cash_revenue_in" integer DEFAULT 0 NOT NULL,
	"cash_expense_out" integer DEFAULT 0 NOT NULL,
	"petty_cash_out" integer DEFAULT 0 NOT NULL,
	"expected_cash" integer DEFAULT 0 NOT NULL,
	"cash_difference" integer DEFAULT 0 NOT NULL,
	"denomination_breakdown" jsonb,
	"recorded_by" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance"."fin_daily_summary" (
	"summary_id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"brand" text NOT NULL,
	"outlet" text NOT NULL,
	"brand_id" text,
	"outlet_id" text,
	"revenue" integer DEFAULT 0 NOT NULL,
	"expense" integer DEFAULT 0 NOT NULL,
	"supplier_cost" integer DEFAULT 0 NOT NULL,
	"petty_cash_out" integer DEFAULT 0 NOT NULL,
	"unpaid_supplier" integer DEFAULT 0 NOT NULL,
	"cash_difference" integer DEFAULT 0 NOT NULL,
	"net_profit_estimate" integer DEFAULT 0 NOT NULL,
	"major_finance_issue" text DEFAULT 'none' NOT NULL,
	"recommended_action" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fin_daily_summary_date_outlet_unique" UNIQUE("date","outlet")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance"."fin_expense" (
	"expense_id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"brand_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"outlet_id" text NOT NULL,
	"outlet_name" text NOT NULL,
	"category_id" text NOT NULL,
	"description" text,
	"amount" integer DEFAULT 0 NOT NULL,
	"payment_method_id" text NOT NULL,
	"attachment_url" text,
	"approval_status" "finance"."finance_approval_status" DEFAULT 'DRAFT' NOT NULL,
	"approved_by" text,
	"notes" text,
	"source" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"recorded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance"."fin_opening_balance" (
	"balance_id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"effective_date" date NOT NULL,
	"cash_balance" integer DEFAULT 0 NOT NULL,
	"petty_cash_balance" integer DEFAULT 0 NOT NULL,
	"unpaid_supplier_opening" integer DEFAULT 0 NOT NULL,
	"receivable_opening" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"recorded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance"."fin_petty_cash" (
	"pc_id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"brand_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"outlet_id" text NOT NULL,
	"outlet_name" text NOT NULL,
	"account_id" text NOT NULL,
	"type" "finance"."petty_cash_type" NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"category_id" text,
	"description" text,
	"attachment_url" text,
	"urgent_flag" boolean DEFAULT false NOT NULL,
	"approval_status" "finance"."finance_approval_status" DEFAULT 'DRAFT' NOT NULL,
	"approved_by" text,
	"source" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"recorded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance"."fin_pos_daily" (
	"pos_id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"brand_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"outlet_id" text NOT NULL,
	"outlet_name" text NOT NULL,
	"gross_sales" integer DEFAULT 0 NOT NULL,
	"net_sales" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"refund" integer DEFAULT 0 NOT NULL,
	"void" integer DEFAULT 0 NOT NULL,
	"tax" integer DEFAULT 0 NOT NULL,
	"service_charge" integer DEFAULT 0 NOT NULL,
	"payment_method_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"aov" integer DEFAULT 0 NOT NULL,
	"cashier" text,
	"shift" text,
	"source" "finance"."pos_source" NOT NULL,
	"source_ref" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"recorded_by" text,
	"verified_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fin_pos_daily_date_outlet_unique" UNIQUE("date","outlet_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance"."fin_supplier_cost" (
	"cost_id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"brand_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"outlet_id" text NOT NULL,
	"outlet_name" text NOT NULL,
	"supplier_id" text NOT NULL,
	"supplier_name" text NOT NULL,
	"description" text,
	"category" text,
	"amount" integer DEFAULT 0 NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"unpaid_amount" integer DEFAULT 0 NOT NULL,
	"payment_status" "finance"."payment_status" DEFAULT 'UNPAID' NOT NULL,
	"approval_status" "finance"."finance_approval_status" DEFAULT 'PENDING' NOT NULL,
	"due_date" date,
	"invoice_number" text,
	"bank_account" text,
	"attachment_url" text,
	"notes" text,
	"source" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"recorded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance"."audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hermez"."hermez_alert_log" (
	"alert_id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"brand" text,
	"outlet" text,
	"alert_type" "hermez"."hermez_alert_type" NOT NULL,
	"severity" "hermez"."hermez_alert_severity" NOT NULL,
	"message" text NOT NULL,
	"source_app" "hermez"."hermez_alert_source_app" NOT NULL,
	"status" "hermez"."hermez_alert_status" DEFAULT 'open' NOT NULL,
	"action_taken" text DEFAULT 'none' NOT NULL,
	"assigned_to" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "hermez_alert_date_outlet_type_unique" UNIQUE("date","outlet","alert_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hermez"."audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hermez"."hermez_config" (
	"config_id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "hermez_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hermez"."hermez_daily_brief" (
	"brief_id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"brief_text" text NOT NULL,
	"alert_level" "hermez"."hermez_alert_level" NOT NULL,
	"sent_to_owner" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp,
	CONSTRAINT "hermez_daily_brief_date_unique" UNIQUE("date")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master"."fin_petty_cash_account" ADD CONSTRAINT "fin_petty_cash_account_outlet_id_master_outlet_outlet_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "master"."master_outlet"("outlet_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master"."hr_rules" ADD CONSTRAINT "hr_rules_outlet_id_master_outlet_outlet_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "master"."master_outlet"("outlet_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master"."master_outlet" ADD CONSTRAINT "master_outlet_brand_id_master_brand_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "master"."master_brand"("brand_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hr"."hr_payroll_line" ADD CONSTRAINT "hr_payroll_line_payroll_id_hr_payroll_payroll_id_fk" FOREIGN KEY ("payroll_id") REFERENCES "hr"."hr_payroll"("payroll_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hr_attendance_date_employee_idx" ON "hr"."hr_attendance" USING btree ("date","employee_id");