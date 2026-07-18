/**
 * @ykp/schema/db/clients
 *
 * Single postgres connection carrying the four domain schemas (master, hr,
 * finance, hermez) as Postgres schemas within one database. Refactored from
 * the original 4-separate-DB layout to support Supabase free-tier (1 DB
 * per project) and simpler Vercel deployment.
 *
 * Cross-schema FKs are still impossible in Postgres (FK constraints cannot
 * cross schema boundaries the same way they couldn't cross databases
 * previously); the application layer continues to validate all master
 * references before INSERT/UPDATE.
 */
import postgres, { type Sql } from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as masterSchema from '../master';
import * as hrSchema from '../hr';
import * as financeSchema from '../finance';
import * as hermezSchema from '../hermez';

const fullSchema = {
  ...masterSchema,
  ...hrSchema,
  ...financeSchema,
  ...hermezSchema,
} as const;

export type FullSchema = typeof fullSchema;
export type Db = PostgresJsDatabase<FullSchema>;

/** Read a single connection URL from env. */
function requireUrl(envVar = "YKP_DATABASE_URL"): string {
  const v = process.env[envVar];
  if (!v || v.trim().length === 0) {
    throw new Error(
      `[schema/db] Missing required env var "${envVar}". ` +
        `Set it before booting the app (single URL for all 4 schemas).`,
    );
  }
  return v;
}

let _db: Db | undefined;
let _sql: Sql | undefined;

/**
 * Materialise the single db client. Idempotent.
 *
 * SSL note: Supabase's transaction pooler (port 6543) presents a self-signed
 * certificate that node-postgres rejects by default. Direct connections to
 * `db.<ref>.supabase.co:5432` use a public CA. If a direct connection is
 * not available, opt out of cert verification for the pooler path only.
 * Prefer the direct host for production traffic.
 */
export function initDbClients(): { db: Db; sql: Sql } {
  if (!_db) {
    const url = requireUrl();
    const isPooler = url.includes(".pooler.supabase.com");
    const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
    _sql = postgres(url, {
      max: 10,
      prepare: false,
      ssl: isPooler ? { rejectUnauthorized: false } : (isLocal ? false : "require"),
    });
    _db = drizzle(_sql, { schema: fullSchema as never });
  }
  return { db: _db!, sql: _sql! };
}

/** Get the singleton db client; throws if init has not run. */
export function getDb(): Db {
  if (!_db) {
    throw new Error("[schema/db] db not initialised — call initDbClients() at boot.");
  }
  return _db;
}

/** Raw postgres Sql handle (for advisory locks, manual queries). */
export function sql(): Sql {
  if (!_sql) {
    throw new Error("[schema/db] sql not initialised — call initDbClients() at boot.");
  }
  return _sql;
}

// ----- Back-compat shims -----
// Existing code references `masterDb`, `hrDb`, etc. via getMasterDb/getHrDb
// accessors. Keep these working during the refactor by aliasing them to the
// single `db`. Code that actually uses the aliases will work because the
// exported table symbols (e.g. masterOutlet) are pgSchema-qualified; Drizzle
// generates `master.master_outlet` regardless of which `db` handle is used.

const _db_ = (): Db => getDb();
export const masterDb = (() => {
  // Lazy proxy: returns the singleton db for any code that imports masterDb
  // and calls select/insert/etc. The table references (masterOutlet, etc.) carry
  // their schema qualifier internally, so SELECT/INSERT target the right schema.
  return new Proxy({} as Db, {
    get(_target, prop) {
      const db = _db_();
      const value = (db as unknown as Record<string | symbol, unknown>)[prop as string];
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(db) : value;
    }
  });
})();

export type MasterDb = Db;
export type HrDb = Db;
export type FinanceDb = Db;
export type HermezDb = Db;

export function getMasterDb(): Db { return getDb(); }
export function getHrDb(): Db { return getDb(); }
export function getFinanceDb(): Db { return getDb(); }
export function getHermezDb(): Db { return getDb(); }
export function createMasterDb(): Db { return getDb(); }
export function createHrDb(): Db { return getDb(); }
export function createFinanceDb(): Db { return getDb(); }
export function createHermezDb(): Db { return getDb(); }
export function masterSql(): Sql { return sql(); }
export function hrSql(): Sql { return sql(); }
export function financeSql(): Sql { return sql(); }
export function hermezSql(): Sql { return sql(); }

// Keep schemaByDb symbol for any external import (engine modules).
export const schemaByDb = {
  master: masterSchema,
  hr: hrSchema,
  finance: financeSchema,
  hermez: hermezSchema,
} as const;
export type SchemaByDb = typeof schemaByDb;