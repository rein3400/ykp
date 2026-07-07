import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { env } from '../config/env.js';
import { logger } from '../services/logger.js';

const MIGRATION_LOCK_KEY = 74_213_721;

export async function runMigrationsIfNeeded(): Promise<void> {
  const client = postgres(env.DATABASE_URL, { max: 1 });
  try {
    // Serializes concurrent attempts from api + worker restart storm.
    await client.unsafe(`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_KEY})`);
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: './drizzle' });
    logger.info('migrations applied (or already current)');
  } finally {
    await client.end();
  }
}

// Allow running as a standalone script for manual/CI migration.
async function main() {
  await runMigrationsIfNeeded();
}

main().catch((err) => {
  logger.fatal({ err }, 'migration failed');
  process.exit(1);
});
