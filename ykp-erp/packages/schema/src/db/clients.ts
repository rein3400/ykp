import postgres, { type Sql } from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as masterSchema from "../master.js";
import * as hrSchema from "../hr.js";
import * as financeSchema from "../finance.js";
import * as hermezSchema from "../hermez.js";

// ============================================================
// Cross-DB FK note
// ------------------------------------------------------------
// PostgreSQL cannot enforce foreign keys across databases.
// Four logical databases (master / hr / finance / hermez) live in
// separate physical Postgres databases, so any reference in hr /
// finance / hermez back to master tables (outlet_id, brand_id,
// supplier_id, employee_id, account_id, category_id,
// payment_method_id, user_id) MUST be validated by the application
// layer before INSERT/UPDATE. On mismatch the API returns HTTP 400
// with a clear "reference not found" message — Postgres will not
// raise an FK violation because there is no constraint to violate.
// The same applies to master references that cross schemas but not
// databases (e.g. hr_rules -> master_outlet inside master DB): those
// CAN and SHOULD be declared as real PG FKs (see master.ts).
// ============================================================

// Schemas keyed per database so drizzle can carry full schema knowledge.
export const schemaByDb = {
  master: masterSchema,
  hr: hrSchema,
  finance: financeSchema,
  hermez: hermezSchema,
} as const;

export type SchemaByDb = typeof schemaByDb;

export type MasterDb = PostgresJsDatabase<typeof masterSchema>;
export type HrDb = PostgresJsDatabase<typeof hrSchema>;
export type FinanceDb = PostgresJsDatabase<typeof financeSchema>;
export type HermezDb = PostgresJsDatabase<typeof hermezSchema>;

// ----- factory -----------------------------------------------------------

/**
 * Build a drizzle client for one logical database.
 *
 * @param url   Postgres connection URL
 * @param dbKey Which schema bundle to attach (master/hr/finance/hermez)
 */
export function createDrizzleClient<TDbKey extends keyof SchemaByDb>(
  url: string,
  dbKey: TDbKey,
): PostgresJsDatabase<SchemaByDb[TDbKey]> {
  const sql = postgres(url, { max: 10, prepare: false });
  return drizzle(sql, { schema: schemaByDb[dbKey] as never }) as PostgresJsDatabase<
    SchemaByDb[TDbKey]
  >;
}

// ----- env resolution ---------------------------------------------------

/**
 * Reads a required DATABASE_URL env var. Throws at boot if missing —
 * we want the process to fail fast rather than silently connecting to
 * a wrong default.
 */
function requireUrl(envVar: string): string {
  const v = process.env[envVar];
  if (!v || v.trim().length === 0) {
    throw new Error(
      `[schema/db] Missing required env var "${envVar}". ` +
        `Set it before booting the app (e.g. in .env or container env).`,
    );
  }
  return v;
}

// ----- factories (lazy) --------------------------------------------------
// We expose factory functions instead of pre-built clients so that the
// schema package can be imported by tooling (drizzle-kit, typecheck)
// without requiring live env vars. The runtime apps call these at boot.

export function createMasterDb(url = process.env.YKP_MASTER_DATABASE_URL): MasterDb {
  return createDrizzleClient(requireUrl("YKP_MASTER_DATABASE_URL"), "master") as MasterDb;
}

export function createHrDb(): HrDb {
  return createDrizzleClient(requireUrl("YKP_HR_DATABASE_URL"), "hr") as HrDb;
}

export function createFinanceDb(): FinanceDb {
  return createDrizzleClient(requireUrl("YKP_FINANCE_DATABASE_URL"), "finance") as FinanceDb;
}

export function createHermezDb(): HermezDb {
  return createDrizzleClient(requireUrl("YKP_HERMEZ_DATABASE_URL"), "hermez") as HermezDb;
}

// ----- boot-time singletons ---------------------------------------------
// `masterDb`/`hrDb`/`financeDb`/`hermezDb` are created lazily on first
// access; importing this module does NOT touch the env. The app calls
// `initDbClients()` once at boot to materialise them and surface any
// missing env var immediately.

let masterDb: MasterDb | undefined;
let hrDb: HrDb | undefined;
let financeDb: FinanceDb | undefined;
let hermezDb: HermezDb | undefined;

/**
 * Materialise all four clients. Throws if any DATABASE_URL env var is
 * missing. Idempotent — calling twice returns the existing instances.
 */
export function initDbClients(): {
  masterDb: MasterDb;
  hrDb: HrDb;
  financeDb: FinanceDb;
  hermezDb: HermezDb;
} {
  if (!masterDb) masterDb = createMasterDb();
  if (!hrDb) hrDb = createHrDb();
  if (!financeDb) financeDb = createFinanceDb();
  if (!hermezDb) hermezDb = createHermezDb();
  return { masterDb, hrDb, financeDb, hermezDb };
}

/** Accessors that throw a helpful error if init hasn't run yet. */
export function getMasterDb(): MasterDb {
  if (!masterDb) {
    throw new Error("[schema/db] masterDb not initialised — call initDbClients() at boot.");
  }
  return masterDb;
}

export function getHrDb(): HrDb {
  if (!hrDb) {
    throw new Error("[schema/db] hrDb not initialised — call initDbClients() at boot.");
  }
  return hrDb;
}

export function getFinanceDb(): FinanceDb {
  if (!financeDb) {
    throw new Error("[schema/db] financeDb not initialised — call initDbClients() at boot.");
  }
  return financeDb;
}

export function getHermezDb(): HermezDb {
  if (!hermezDb) {
    throw new Error("[schema/db] hermezDb not initialised — call initDbClients() at boot.");
  }
  return hermezDb;
}

// Raw postgres `Sql` handles (for advisory locks, etc.).
export function masterSql(): Sql {
  return (getMasterDb() as unknown as { $client: Sql }).$client;
}
export function hrSql(): Sql {
  return (getHrDb() as unknown as { $client: Sql }).$client;
}
export function financeSql(): Sql {
  return (getFinanceDb() as unknown as { $client: Sql }).$client;
}
export function hermezSql(): Sql {
  return (getHermezDb() as unknown as { $client: Sql }).$client;
}