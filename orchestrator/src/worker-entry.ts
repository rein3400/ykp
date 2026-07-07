import { startWorkers, shutdownWorkers } from './queues.js';
import { startLongPolling, stopBot, setWebhook } from './modules/telegram-bot.js';
import { ensureOwnerFromEnv } from './modules/auth.js';
import { logger } from './services/logger.js';
import { env } from './config/env.js';
import { runMigrationsIfNeeded } from './db/run-migrations.js';

async function main(): Promise<void> {
  logger.info('YKP Orchestrator worker process starting...');
  await runMigrationsIfNeeded().catch((err) => {
    logger.fatal({ err }, 'migration failed at worker startup');
    process.exit(1);
  });
  await ensureOwnerFromEnv();
  await startWorkers();
  // Only start bot if token is configured. In prod use webhook mode (via Cloudflare Tunnel);
  // in dev, fall back to long-polling.
  if (env.TELEGRAM_BOT_TOKEN) {
    if (env.TELEGRAM_WEBHOOK_MODE && env.PUBLIC_BASE_URL) {
      const url = `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/telegram/webhook`;
      try {
        await setWebhook(url, env.TELEGRAM_WEBHOOK_SECRET);
      } catch (e) {
        logger.error({ e, url }, 'setWebhook failed');
      }
    } else {
      await startLongPolling().catch((e) => logger.error({ e }, 'bot start failed'));
    }
  } else {
    logger.warn('TELEGRAM_BOT_TOKEN not set; skipping bot');
  }

  const shutdown = async (sig: string) => {
    logger.info({ sig }, 'worker shutdown');
    await stopBot().catch(() => {});
    await shutdownWorkers();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => logger.fatal({ err }, 'unhandledRejection'));
  process.on('uncaughtException', (err) => logger.fatal({ err }, 'uncaughtException'));
}

main().catch((err) => {
  logger.fatal({ err }, 'worker entry fatal');
  process.exit(1);
});