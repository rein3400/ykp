#!/usr/bin/env node

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initDbClients, sql } from './db/clients';

const ADVISORY_LOCK_ID = 74213721;

// Single migrations folder contains all four domain schemas (master, hr,
// finance, hermez) after the schema-qualified refactor.

function migrationsFolder(): string {
  // FileURLToPath + dirname is more portable than `new URL(...).pathname`
  // on Windows paths with spaces (e.g. `YKP HERMEZ AI COMMAND CENTER`).
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "migrations");
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