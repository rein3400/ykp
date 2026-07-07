// ============================================================
// @ykp/engine — Cron helpers (BullMQ)
// ------------------------------------------------------------
// Schedules the Hermez daily brief generation at 22:00 WIB
// (= 15:00 UTC) and a retry at 22:15 WIB (= 15:15 UTC).
//
// Usage (apps/hermez):
//   import { scheduleHermezCron } from "@ykp/engine/cron";
//   await scheduleHermezCron({ redisUrl, runHourUtc: 15 });
// ============================================================

import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

export const HERMEZ_BRIEF_QUEUE = "hermez-brief";
export const HERMEZ_RETRY_QUEUE = "hermez-brief-retry";

export type BriefJobData = {
  date: string; // YYYY-MM-DD WIB
  triggeredBy: "cron" | "manual";
};

export type CronConfig = {
  redisUrl: string;
  runHourUtc?: number; // default 15 = 22:00 WIB
};

/** Build a BullMQ Queue using a new ioredis connection. */
function makeConnection(redisUrl: string): IORedis {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

/**
 * Register the brief-generation cron and retry queues. Returns the
 * queues so the caller can register workers. Idempotent: re-running
 * does not duplicate jobs.
 */
export async function scheduleHermezCron(cfg: CronConfig) {
  const hour = cfg.runHourUtc ?? 15;
  const conn = makeConnection(cfg.redisUrl);

  const brief = new Queue<BriefJobData>(HERMEZ_BRIEF_QUEUE, { connection: conn });
  const retry = new Queue<BriefJobData>(HERMEZ_RETRY_QUEUE, { connection: conn });

  // Wipe any existing repeatable jobs and re-add with current schedule.
  const briefRepeatables = await brief.getRepeatableJobs();
  for (const r of briefRepeatables) await brief.removeRepeatableByKey(r.key);
  await brief.add(
    "generate",
    { date: "", triggeredBy: "cron" },
    { repeat: { pattern: `0 ${hour} * * *`, tz: "UTC" }, removeOnComplete: 100, removeOnFail: 200 },
  );

  const retryRepeatables = await retry.getRepeatableJobs();
  for (const r of retryRepeatables) await retry.removeRepeatableByKey(r.key);
  await retry.add(
    "retry-send",
    { date: "", triggeredBy: "cron" },
    { repeat: { pattern: `15 ${hour} * * *`, tz: "UTC" }, removeOnComplete: 100, removeOnFail: 200 },
  );

  return { brief, retry, connection: conn };
}

/**
 * Register a worker for the brief queue. The handler is called
 * for every job and is responsible for actually generating the
 * brief (see @ykp/engine/hermez-brief).
 */
export function makeBriefWorker(
  redisUrl: string,
  handler: (job: Job<BriefJobData>) => Promise<void>,
): Worker<BriefJobData> {
  return new Worker<BriefJobData>(HERMEZ_BRIEF_QUEUE, handler, {
    connection: makeConnection(redisUrl),
    concurrency: 1,
  });
}

export function makeRetryWorker(
  redisUrl: string,
  handler: (job: Job<BriefJobData>) => Promise<void>,
): Worker<BriefJobData> {
  return new Worker<BriefJobData>(HERMEZ_RETRY_QUEUE, handler, {
    connection: makeConnection(redisUrl),
    concurrency: 1,
  });
}