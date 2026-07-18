CREATE TYPE "hermez"."hermez_action_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "hermez"."hermez_action_status" AS ENUM('OPEN', 'IN_PROGRESS', 'WAITING_APPROVAL', 'DONE', 'CANCELLED', 'OVERDUE');--> statement-breakpoint
ALTER TYPE "hermez"."hermez_alert_type" ADD VALUE 'ops_incident_spike';--> statement-breakpoint
ALTER TYPE "hermez"."hermez_alert_type" ADD VALUE 'ops_waste_high';--> statement-breakpoint
ALTER TYPE "hermez"."hermez_alert_type" ADD VALUE 'ops_over_sla';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance"."fin_pos_receipts" (
	"receipt_id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"brand_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"outlet_id" text NOT NULL,
	"outlet_name" text NOT NULL,
	"receipt_number" text NOT NULL,
	"transaction_time" text,
	"gross_sales" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"refund" integer DEFAULT 0 NOT NULL,
	"void" integer DEFAULT 0 NOT NULL,
	"tax" integer DEFAULT 0 NOT NULL,
	"service_charge" integer DEFAULT 0 NOT NULL,
	"net_sales" integer DEFAULT 0 NOT NULL,
	"payment_method_id" text,
	"payment_amount" integer DEFAULT 0 NOT NULL,
	"payment_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"transaction_count" integer DEFAULT 1 NOT NULL,
	"cashier" text,
	"shift" text,
	"source" "finance"."pos_source" DEFAULT 'manual' NOT NULL,
	"source_ref" text,
	"notes" text,
	"photo_url" text,
	"photo_path" text,
	"verified_by" text,
	"verified_at" timestamp,
	"recorded_by" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fin_pos_receipts_date_outlet_receipt_unique" UNIQUE("date","outlet_id","receipt_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hermez"."hermez_action_tracker" (
	"action_id" text PRIMARY KEY NOT NULL,
	"source_alert_id" text,
	"title" text NOT NULL,
	"brand" text,
	"outlet" text,
	"assigned_to" text,
	"priority" "hermez"."hermez_action_priority" DEFAULT 'MEDIUM' NOT NULL,
	"due_date" date,
	"status" "hermez"."hermez_action_status" DEFAULT 'OPEN' NOT NULL,
	"action_taken" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hermez"."hermez_telegram_log" (
	"log_id" text PRIMARY KEY NOT NULL,
	"message_id" text,
	"recipient" text NOT NULL,
	"channel" text DEFAULT 'owner' NOT NULL,
	"status" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance"."fin_daily_summary" ADD COLUMN "settlement_difference" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."fin_expense" ADD COLUMN "source_module" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_expense" ADD COLUMN "source_transaction_id" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_expense" ADD COLUMN "payment_source" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_expense" ADD COLUMN "linked_supplier_invoice_id" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_expense" ADD COLUMN "linked_petty_cash_id" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_expense" ADD COLUMN "linked_payment_id" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_petty_cash" ADD COLUMN "source_module" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_petty_cash" ADD COLUMN "source_transaction_id" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_petty_cash" ADD COLUMN "payment_source" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_petty_cash" ADD COLUMN "linked_expense_id" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_petty_cash" ADD COLUMN "linked_supplier_invoice_id" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_petty_cash" ADD COLUMN "linked_payment_id" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_supplier_cost" ADD COLUMN "source_module" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_supplier_cost" ADD COLUMN "source_transaction_id" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_supplier_cost" ADD COLUMN "payment_source" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_supplier_cost" ADD COLUMN "linked_expense_id" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_supplier_cost" ADD COLUMN "linked_petty_cash_id" text;--> statement-breakpoint
ALTER TABLE "finance"."fin_supplier_cost" ADD COLUMN "linked_payment_id" text;--> statement-breakpoint
ALTER TABLE "hermez"."hermez_alert_log" ADD COLUMN "environment" text DEFAULT 'PRODUCTION' NOT NULL;--> statement-breakpoint
ALTER TABLE "hermez"."hermez_config" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "hermez"."hermez_config" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "hermez"."hermez_config" ADD COLUMN "severity" text DEFAULT 'warning' NOT NULL;--> statement-breakpoint
ALTER TABLE "hermez"."hermez_config" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "hermez"."hermez_config" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "hermez"."hermez_daily_brief" ADD COLUMN "environment" text DEFAULT 'PRODUCTION' NOT NULL;