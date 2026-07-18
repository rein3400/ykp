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
DROP VIEW IF EXISTS "finance"."fin_pos_daily_view";--> statement-breakpoint
CREATE OR REPLACE VIEW "finance"."fin_pos_daily_view" AS
SELECT
  'POS-' || to_char(r."date", 'YYYYMMDD') || '-' || r."outlet_id" AS "pos_id",
  r."date",
  r."brand_id",
  r."brand_name",
  r."outlet_id",
  r."outlet_name",
  COALESCE(SUM(r."gross_sales"), 0) AS "gross_sales",
  COALESCE(SUM(r."net_sales"), 0) AS "net_sales",
  COALESCE(SUM(r."discount"), 0) AS "discount",
  COALESCE(SUM(r."refund"), 0) AS "refund",
  COALESCE(SUM(r."void"), 0) AS "void",
  COALESCE(SUM(r."tax"), 0) AS "tax",
  COALESCE(SUM(r."service_charge"), 0) AS "service_charge",
  COALESCE(
    jsonb_object_agg(pm."method_id", pm."total") FILTER (WHERE pm."method_id" IS NOT NULL),
    '{}'::jsonb
  ) AS "payment_method_breakdown",
  COALESCE(SUM(r."transaction_count"), 0) AS "transaction_count",
  CASE WHEN COALESCE(SUM(r."transaction_count"), 0) > 0
    THEN ROUND(SUM(r."net_sales")::numeric / SUM(r."transaction_count"))::integer
    ELSE 0
  END AS "aov",
  (SELECT string_agg(DISTINCT cashier, ', ') FROM "finance"."fin_pos_receipts" r2 WHERE r2."date" = r."date" AND r2."outlet_id" = r."outlet_id") AS "cashier",
  (SELECT string_agg(DISTINCT shift, ', ') FROM "finance"."fin_pos_receipts" r2 WHERE r2."date" = r."date" AND r2."outlet_id" = r."outlet_id") AS "shift",
  (SELECT mode() WITHIN GROUP (ORDER BY source) FROM "finance"."fin_pos_receipts" r2 WHERE r2."date" = r."date" AND r2."outlet_id" = r."outlet_id")::text AS "source",
  NULL::text AS "source_ref",
  (SELECT string_agg(DISTINCT notes, '; ') FROM "finance"."fin_pos_receipts" r2 WHERE r2."date" = r."date" AND r2."outlet_id" = r."outlet_id") AS "notes",
  MAX(r."recorded_at") AS "recorded_at",
  MAX(r."recorded_by") AS "recorded_by",
  MAX(r."created_at") AS "created_at",
  MAX(r."updated_at") AS "updated_at"
FROM "finance"."fin_pos_receipts" r
LEFT JOIN LATERAL (
  SELECT key AS "method_id", value::integer AS "total"
  FROM jsonb_each_text(r."payment_breakdown")
) pm ON true
GROUP BY r."date", r."brand_id", r."brand_name", r."outlet_id", r."outlet_name";
