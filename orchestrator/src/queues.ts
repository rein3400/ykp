import { Queue, Worker, type Processor } from 'bullmq';
import { env } from './config/env.js';
import { logger } from './services/logger.js';

function connOpts() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    username: url.username || undefined,
    maxRetriesPerRequest: null
  };
}

export const dailyReportQueue = new Queue('daily-report', { connection: connOpts() });
export const backupQueue = new Queue('backup', { connection: connOpts() });
export const monitorQueue = new Queue('monitor', { connection: connOpts() });
export const knowledgeQueue = new Queue('knowledge', { connection: connOpts() });
export const weeklyReviewQueue = new Queue('weekly-review', { connection: connOpts() });
export const auditEveningQueue = new Queue('audit-evening', { connection: connOpts() });
export const journalReviewQueue = new Queue('journal-review', { connection: connOpts() });

export async function startWorkers(): Promise<void> {
  const dailyReportProcessor: Processor = async () => {
    const mod = await import('./workers/daily-report.js');
    await mod.runDailyReport();
  };
  const backupProcessor: Processor = async () => {
    const mod = await import('./workers/backup.js');
    await mod.runBackup();
  };
  const monitorProcessor: Processor = async () => {
    const mod = await import('./workers/monitor.js');
    await mod.runMonitor();
  };
  const knowledgeProcessor: Processor = async () => {
    const { runKnowledgeNudge } = await import('./workers/knowledge-nudge.js');
    await runKnowledgeNudge();
  };
  const weeklyReviewProcessor: Processor = async () => {
    const { runWeeklyReview } = await import('./workers/weekly-review.js');
    await runWeeklyReview();
  };
  const auditEveningProcessor: Processor = async () => {
    const { runAuditEvening } = await import('./workers/audit-evening.js');
    await runAuditEvening();
  };
  const journalReviewProcessor: Processor = async () => {
    const { runJournalReview } = await import('./workers/journal-review.js');
    await runJournalReview();
  };

  new Worker('daily-report', dailyReportProcessor, { connection: connOpts() });
  new Worker('backup', backupProcessor, { connection: connOpts() });
  new Worker('monitor', monitorProcessor, { connection: connOpts() });
  new Worker('knowledge', knowledgeProcessor, { connection: connOpts() });
  new Worker('weekly-review', weeklyReviewProcessor, { connection: connOpts() });
  new Worker('audit-evening', auditEveningProcessor, { connection: connOpts() });
  new Worker('journal-review', journalReviewProcessor, { connection: connOpts() });

  const [dailyMin, dailyHour] = env.DAILY_REPORT_CRON.split(' ').slice(0, 2);
  await dailyReportQueue.add('run', {}, {
    repeat: { pattern: `${dailyMin} ${dailyHour} * * *`, tz: 'Asia/Jakarta' }
  });

  const [backupMin, backupHour] = env.BACKUP_CRON.split(' ').slice(0, 2);
  await backupQueue.add('run', {}, {
    repeat: { pattern: `${backupMin} ${backupHour} * * *`, tz: 'Asia/Jakarta' }
  });

  await monitorQueue.add('run', {}, {
    repeat: { every: env.MONITOR_INTERVAL_SECONDS * 1000 }
  });

  // Senin 06:00 WIB nudge: tambah minimal 3 knowledge baru
  await knowledgeQueue.add('run', {}, {
    repeat: { pattern: '0 6 * * 1', tz: 'Asia/Jakarta' }
  });

  // Minggu 21:00 WIB weekly review
  await weeklyReviewQueue.add('run', {}, {
    repeat: { pattern: '0 21 * * 0', tz: 'Asia/Jakarta' }
  });

  // Audit 15-23 menit ke 0, Mon-Fri (around US session close)
  await auditEveningQueue.add('run', {}, {
    repeat: { pattern: '*/15 16-23 * * 1-5', tz: 'Asia/Jakarta' }
  });

  // Mid-week journal review (Rabu 12:00 WIB)
  await journalReviewQueue.add('run', {}, {
    repeat: { pattern: '0 12 * * 3', tz: 'Asia/Jakarta' }
  });

  logger.info(
    { dailyReport: env.DAILY_REPORT_CRON, backup: env.BACKUP_CRON, knowledge: '0 6 * * 1', weeklyReview: '0 21 * * 0', audit: '*/15 16-23 * * 1-5', journal: '0 12 * * 3' },
    'workers scheduled'
  );
}

export async function shutdownWorkers(): Promise<void> {
  await Promise.all([
    dailyReportQueue.close(),
    backupQueue.close(),
    monitorQueue.close(),
    knowledgeQueue.close(),
    weeklyReviewQueue.close(),
    auditEveningQueue.close(),
    journalReviewQueue.close()
  ]);
}