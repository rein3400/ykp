/**
 * One-shot: run only finance_v2_receipts (table + legacy migrate + view).
 * Skips drizzle-kit migrations that fail on already-existing enums in prod.
 *
 * Usage (with Railway env):
 *   railway run --service ykp-erp-finance --environment production -- \
 *     npx tsx scripts/finance-v2-receipts-only.mts
 */
import { sql } from "drizzle-orm";
import { initDbClients, sql as rawSql } from "../packages/schema/src/db/clients.ts";
import type { Db } from "../packages/schema/src/db/clients.ts";

const ADVISORY_LOCK_ID = 74213721;

async function financeV2Receipts(db: Db) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS finance.fin_pos_receipts (
      receipt_id text PRIMARY KEY,
      date date NOT NULL,
      brand_id text NOT NULL,
      brand_name text NOT NULL,
      outlet_id text NOT NULL,
      outlet_name text NOT NULL,
      receipt_number text NOT NULL,
      transaction_time text,
      gross_sales integer NOT NULL DEFAULT 0,
      discount integer NOT NULL DEFAULT 0,
      refund integer NOT NULL DEFAULT 0,
      void integer NOT NULL DEFAULT 0,
      tax integer NOT NULL DEFAULT 0,
      service_charge integer NOT NULL DEFAULT 0,
      net_sales integer NOT NULL DEFAULT 0,
      payment_method_id text,
      payment_amount integer NOT NULL DEFAULT 0,
      payment_breakdown jsonb NOT NULL DEFAULT '{}',
      transaction_count integer NOT NULL DEFAULT 1,
      cashier text,
      shift text,
      source finance.pos_source NOT NULL DEFAULT 'manual',
      source_ref text,
      notes text,
      photo_url text,
      photo_path text,
      verified_by text,
      verified_at timestamp,
      recorded_by text,
      recorded_at timestamp NOT NULL DEFAULT now(),
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (date, outlet_id, receipt_number)
    );

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'finance' AND table_name = 'fin_pos_daily'
      ) THEN
        INSERT INTO finance.fin_pos_receipts (
          receipt_id, date, brand_id, brand_name, outlet_id, outlet_name,
          receipt_number, transaction_time, gross_sales, discount, refund, void, tax, service_charge,
          net_sales, payment_amount, payment_breakdown, transaction_count, cashier,
          shift, source, source_ref, notes, recorded_by, recorded_at, created_at,
          updated_at
        )
        SELECT
          'RCP-' || to_char(d.date, 'YYYYMMDD') || '-' || d.outlet_id || '-LEGACY-' || row_number() OVER (PARTITION BY d.date, d.outlet_id ORDER BY d.created_at)::text,
          d.date, d.brand_id, d.brand_name, d.outlet_id, d.outlet_name,
          'LEGACY-' || to_char(d.date, 'YYYYMMDD') || '-' || d.outlet_id || '-' || row_number() OVER (PARTITION BY d.date, d.outlet_id ORDER BY d.created_at)::text,
          NULL::text,
          d.gross_sales, d.discount, d.refund, d.void, d.tax, d.service_charge,
          d.net_sales,
          CASE
            WHEN jsonb_typeof(COALESCE(d.payment_method_breakdown, '{}'::jsonb)) = 'object'
              THEN COALESCE((SELECT sum(value::integer) FROM jsonb_each_text(d.payment_method_breakdown)), 0)
            ELSE COALESCE(d.net_sales, 0)
          END,
          CASE
            WHEN jsonb_typeof(COALESCE(d.payment_method_breakdown, '{}'::jsonb)) = 'object'
              THEN COALESCE(d.payment_method_breakdown, '{}'::jsonb)
            ELSE '{}'::jsonb
          END,
          d.transaction_count,
          d.cashier, d.shift, d.source, d.source_ref, d.notes, d.recorded_by,
          d.recorded_at, d.created_at, d.updated_at
        FROM finance.fin_pos_daily d
        ON CONFLICT (date, outlet_id, receipt_number) DO NOTHING;

        DROP TABLE IF EXISTS finance.fin_pos_daily CASCADE;
      END IF;
    END $$;

    DROP VIEW IF EXISTS finance.fin_pos_daily_view;

    CREATE OR REPLACE VIEW finance.fin_pos_daily_view AS
    SELECT
      'POS-' || to_char(r.date, 'YYYYMMDD') || '-' || r.outlet_id AS pos_id,
      r.date,
      r.brand_id,
      r.brand_name,
      r.outlet_id,
      r.outlet_name,
      COALESCE(SUM(r.gross_sales), 0) AS gross_sales,
      COALESCE(SUM(r.net_sales), 0) AS net_sales,
      COALESCE(SUM(r.discount), 0) AS discount,
      COALESCE(SUM(r.refund), 0) AS refund,
      COALESCE(SUM(r.void), 0) AS void,
      COALESCE(SUM(r.tax), 0) AS tax,
      COALESCE(SUM(r.service_charge), 0) AS service_charge,
      COALESCE(
        jsonb_object_agg(pm.method_id, pm.total) FILTER (WHERE pm.method_id IS NOT NULL),
        '{}'::jsonb
      ) AS payment_method_breakdown,
      COALESCE(SUM(r.transaction_count), 0) AS transaction_count,
      CASE WHEN COALESCE(SUM(r.transaction_count), 0) > 0
        THEN ROUND(SUM(r.net_sales)::numeric / SUM(r.transaction_count))::integer
        ELSE 0
      END AS aov,
      (SELECT string_agg(DISTINCT cashier, ', ') FROM finance.fin_pos_receipts r2 WHERE r2.date = r.date AND r2.outlet_id = r.outlet_id) AS cashier,
      (SELECT string_agg(DISTINCT shift, ', ') FROM finance.fin_pos_receipts r2 WHERE r2.date = r.date AND r2.outlet_id = r.outlet_id) AS shift,
      (SELECT mode() WITHIN GROUP (ORDER BY source) FROM finance.fin_pos_receipts r2 WHERE r2.date = r.date AND r2.outlet_id = r.outlet_id)::text AS source,
      NULL::text AS source_ref,
      (SELECT string_agg(DISTINCT notes, '; ') FROM finance.fin_pos_receipts r2 WHERE r2.date = r.date AND r2.outlet_id = r.outlet_id) AS notes,
      MAX(r.recorded_at) AS recorded_at,
      MAX(r.recorded_by) AS recorded_by,
      MAX(r.created_at) AS created_at,
      MAX(r.updated_at) AS updated_at
    FROM finance.fin_pos_receipts r
    LEFT JOIN LATERAL (
      SELECT key AS method_id, value::integer AS total
      FROM jsonb_each_text(r.payment_breakdown)
    ) pm ON true
    GROUP BY r.date, r.brand_id, r.brand_name, r.outlet_id, r.outlet_name;
  `);
}

async function main() {
  if (!process.env.YKP_DATABASE_URL) {
    console.error("[finance-v2] YKP_DATABASE_URL not set");
    process.exit(1);
  }
  initDbClients();
  const s = rawSql();
  await s`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_ID})`;
  console.log(`[finance-v2] lock ${ADVISORY_LOCK_ID} acquired`);
  const { db } = initDbClients();
  await financeV2Receipts(db);
  console.log("[finance-v2] receipts table + view ready");
  // verify
  const tables = await s`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='finance' AND table_name IN ('fin_pos_receipts','fin_pos_daily')
    ORDER BY table_name
  `;
  const views = await s`
    SELECT table_name FROM information_schema.views
    WHERE table_schema='finance' AND table_name='fin_pos_daily_view'
  `;
  console.log("[finance-v2] tables:", tables);
  console.log("[finance-v2] views:", views);
  await s.end();
}

main().catch((e) => {
  console.error("[finance-v2] failed:", e);
  process.exit(1);
});
