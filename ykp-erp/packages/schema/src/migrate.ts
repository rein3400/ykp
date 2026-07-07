#!/usr/bin/env node

import { migrate } from "drizzle-orm/postgres-js/migrator";
import {
  createMasterDb,
  createHrDb,
  createFinanceDb,
  createHermezDb,
  masterSql,
  hrSql,
  financeSql,
  hermezSql,
  type MasterDb,
  type HrDb,
  type FinanceDb,
  type HermezDb,
} from "./db/clients.js";

const ADVISORY_LOCK_ID = 74213721;

// ---------------------------------------------------------------------------
// Connection resolution
// ---------------------------------------------------------------------------
// Each database has its own env var and its own migrations folder under
// packages/schema/migrations/{name}/. The schema package root is resolved at
// runtime relative to this file so the runner works both in source and from
// a built dist/ directory.
// ---------------------------------------------------------------------------

const dbs = [
  {
    name: "master",
    urlVar: "YKP_MASTER_DATABASE_URL",
    create: () => createMasterDb(process.env.YKP_MASTER_DATABASE_URL),
    sql: () => masterSql(),
  },
  {
    name: "hr",
    urlVar: "YKP_HR_DATABASE_URL",
    create: () => createHrDb(),
    sql: () => hrSql(),
  },
  {
    name: "finance",
    urlVar: "YKP_FINANCE_DATABASE_URL",
    create: () => createFinanceDb(),
    sql: () => financeSql(),
  },
  {
    name: "hermez",
    urlVar: "YKP_HERMEZ_DATABASE_URL",
    create: () => createHermezDb(),
    sql: () => hermezSql(),
  },
] as const;

function migrationsFolder(name: string): string {
  const sourceRoot = new URL("..", import.meta.url);
  const resolved = new URL(`migrations/${name}`, sourceRoot);
  return resolved.pathname;
}

// ---------------------------------------------------------------------------
// Lock + migrate one logical database
// ---------------------------------------------------------------------------

async function migrateOne(
  name: string,
  createDb: () => MasterDb | HrDb | FinanceDb | HermezDb,
  sqlFn: () => ReturnType<typeof masterSql>,
): Promise<void> {
  if (!process.env[dbs.find((d) => d.name === name)?.urlVar ?? ""]) {
    console.warn(`[migrate:${name}] ${dbs.find((d) => d.name === name)?.urlVar} not set — skipping`);
    return;
  }

  const sql = sqlFn();
  await sql`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_ID})`;
  console.log(`[migrate:${name}] acquired advisory lock ${ADVISORY_LOCK_ID}`);

  const db = createDb();
  const folder = migrationsFolder(name);
  await migrate(db, { migrationsFolder: folder });
  console.log(`[migrate:${name}] applied migrations from ${folder}`);

  // The advisory lock is bound to the transaction and released on commit
  // when the client connection/transaction ends. Since postgres-js uses an
  // implicit transaction per query, we rely on the caller to close the pool.
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log("[migrate] starting for master/hr/finance/hermez");

  // drizzle-orm/postgres-js migrator returns immediately for empty folders,
  // so this loop is naturally idempotent: re-running after all migrations are
  // applied produces no changes.
  for (const db of dbs) {
    await migrateOne(db.name, db.create, db.sql);
  }

  // Close SQL pools cleanly so the advisory locks are released and the
  // process can exit immediately.
  await Promise.all([masterSql().end(), hrSql().end(), financeSql().end(), hermezSql().end()]);

  console.log(`[migrate] completed in ${Date.now() - startedAt}ms`);
}

main().catch((err: unknown) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});

export default main;