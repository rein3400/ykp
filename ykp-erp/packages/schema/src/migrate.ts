#!/usr/bin/env node

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initDbClients, sql as rawSql } from './db/clients';
import type { Db } from './db/clients';

const ADVISORY_LOCK_ID = 74213721;

// Single migrations folder contains all four domain schemas (master, hr,
// finance, hermez) after the schema-qualified refactor.

function migrationsFolder(): string {
  // FileURLToPath + dirname is more portable than `new URL(...).pathname`
  // on Windows paths with spaces (e.g. `YKP HERMEZ AI COMMAND CENTER`).
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "migrations");
}

// finance_v2_receipts: promote individual receipts to source of truth,
// migrate legacy fin_pos_daily rows into receipts, drop the old table,
// and recreate a daily aggregate view that preserves the old column shape.
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
          receipt_number, gross_sales, discount, refund, void, tax, service_charge,
          net_sales, payment_amount, payment_breakdown, transaction_count, cashier,
          shift, source, source_ref, notes, recorded_by, recorded_at, created_at,
          updated_at
        )
        SELECT
          'RCP-' || to_char(d.date, 'YYYYMMDD') || '-' || d.outlet_id || '-LEGACY-' || row_number() OVER (PARTITION BY d.date, d.outlet_id ORDER BY d.created_at)::text,
          d.date, d.brand_id, d.brand_name, d.outlet_id, d.outlet_name,
          'LEGACY-' || to_char(d.date, 'YYYYMMDD') || '-' || d.outlet_id,
          d.gross_sales, d.discount, d.refund, d.void, d.tax, d.service_charge,
          d.net_sales,
          COALESCE((SELECT sum(value::integer) FROM jsonb_each_text(d.payment_method_breakdown)), 0),
          d.payment_method_breakdown,
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

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log("[migrate] starting (single DB, schema-per-domain: master/hr/finance/hermez)");

  if (!process.env.YKP_DATABASE_URL) {
    console.error("[migrate] YKP_DATABASE_URL not set — aborting");
    process.exit(1);
  }

  initDbClients();
  const s = rawSql();
  await s`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_ID})`;
  console.log(`[migrate] acquired advisory lock ${ADVISORY_LOCK_ID}`);

  const { db } = initDbClients();
  const folder = migrationsFolder();
  await migrate(db, { migrationsFolder: folder });
  console.log(`[migrate] applied migrations from ${folder}`);

  await financeV2Receipts(db);
  console.log("[migrate] finance_v2_receipts step completed");

  await s.end();
  console.log(`[migrate] completed in ${Date.now() - startedAt}ms`);
}

// Only auto-execute when invoked as a CLI script, not when imported as a module.
// Prevents side effects during Next.js build / module bundling.
const isMain = import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("migrate") ||
  process.argv[1]?.endsWith("migrate.ts") ||
  process.argv[1]?.endsWith("migrate.mjs") ||
  process.argv[1]?.endsWith("migrate.js");
if (isMain) {
  main().catch((err: unknown) => {
    console.error("[migrate] failed:", err);
    process.exit(1);
  });
}

export default main;
