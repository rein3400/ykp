/* Sync Hermez schema to Drizzle definition (additive DDL, idempotent).
 * Run: npx tsx tests/hermez-schema-sync.mts
 * Adds missing columns + creates missing tables in the hermez schema
 * of the configured Hermez DB. Never drops data.
 */
import { initDbClients, createHermezDb } from "../packages/schema/src";

const DDL: string[] = [
  `ALTER TABLE hermez.hermez_daily_brief ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'PRODUCTION';`,
  `ALTER TABLE hermez.hermez_alert_log ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'PRODUCTION';`,
  `ALTER TABLE hermez.hermez_config ADD COLUMN IF NOT EXISTS label text;`,
  `ALTER TABLE hermez.hermez_config ADD COLUMN IF NOT EXISTS unit text;`,
  `ALTER TABLE hermez.hermez_config ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'warning';`,
  `ALTER TABLE hermez.hermez_config ADD COLUMN IF NOT EXISTS description text;`,
  `ALTER TABLE hermez.hermez_config ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;`,
  `CREATE TABLE IF NOT EXISTS hermez.hermez_telegram_log (
    log_id text PRIMARY KEY NOT NULL,
    message_id text,
    recipient text NOT NULL,
    channel text NOT NULL DEFAULT 'owner',
    status text NOT NULL,
    sent_at timestamp DEFAULT now() NOT NULL,
    error_message text,
    retry_count integer NOT NULL DEFAULT 0
  );`,
  `DO $$ BEGIN
    CREATE TYPE hermez.hermez_action_priority AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
    CREATE TYPE hermez.hermez_action_status AS ENUM ('OPEN','IN_PROGRESS','WAITING_APPROVAL','DONE','CANCELLED','OVERDUE');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `CREATE TABLE IF NOT EXISTS hermez.hermez_action_tracker (
    action_id text PRIMARY KEY NOT NULL,
    source_alert_id text,
    title text NOT NULL,
    brand text,
    outlet text,
    assigned_to text,
    priority hermez.hermez_action_priority NOT NULL DEFAULT 'MEDIUM',
    due_date date,
    status hermez.hermez_action_status NOT NULL DEFAULT 'OPEN',
    action_taken text,
    created_at timestamp DEFAULT now() NOT NULL,
    completed_at timestamp
  );`,
];

async function main() {
  initDbClients();
  const db = createHermezDb();
  for (const stmt of DDL) {
    try {
      await db.execute(stmt as never);
      console.log("[sync] OK:", stmt.slice(0, 70).replace(/\s+/g, " "));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[sync] FAILED:", stmt.slice(0, 70).replace(/\s+/g, " "), "->", msg);
    }
  }
  console.log("[sync] done");
  process.exit(0);
}

void main();