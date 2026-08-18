#!/usr/bin/env node

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { initDbClients, sql } from './db/clients';

const ADVISORY_LOCK_ID = 74213721;

// Single migrations folder contains all four domain schemas (master, hr,
// finance, hermez) after the schema-qualified refactor.

function migrationsFolder(): string {
  const sourceRoot = new URL("..", import.meta.url);
  const resolved = new URL(`migrations`, sourceRoot);
  return resolved.pathname;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log("[migrate] starting (single DB, schema-per-domain: master/hr/finance/hermez)");

  if (!process.env.YKP_DATABASE_URL) {
    console.error("[migrate] YKP_DATABASE_URL not set — aborting");
    process.exit(1);
  }

  initDbClients();
  const s = sql();
  await s`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_ID})`;
  console.log(`[migrate] acquired advisory lock ${ADVISORY_LOCK_ID}`);

  const { db } = initDbClients();
  const folder = migrationsFolder();
  await migrate(db, { migrationsFolder: folder });
  console.log(`[migrate] applied migrations from ${folder}`);

  await s.end();
  console.log(`[migrate] completed in ${Date.now() - startedAt}ms`);
}

main().catch((err: unknown) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});

export default main;