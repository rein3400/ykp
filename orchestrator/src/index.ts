import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './services/logger.js';
import { redis } from './services/redis.js';
import { runMigrationsIfNeeded } from './db/run-migrations.js';

async function main(): Promise<void> {
  await runMigrationsIfNeeded().catch((err) => {
    logger.fatal({ err }, 'migration failed at startup');
    process.exit(1);
  });

  const app = await buildApp();

  try {
    await app.listen({ port: env.APP_PORT, host: env.APP_HOST });
    logger.info({ port: env.APP_PORT, host: env.APP_HOST }, 'YKP Orchestrator listening');
  } catch (err) {
    logger.fatal({ err }, 'failed to start server');
    process.exit(1);
  }

  const shutdown = async (sig: string) => {
    logger.info({ sig }, 'shutdown signal received');
    try {
      await app.close();
      await redis.quit();
    } catch {
      // ignore
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (err) => logger.fatal({ err }, 'unhandledRejection'));
  process.on('uncaughtException', (err) => logger.fatal({ err }, 'uncaughtException'));
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal startup error');
  process.exit(1);
});