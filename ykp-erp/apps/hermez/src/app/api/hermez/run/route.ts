import {
  createHermezDb,
  createHrDb,
  createFinanceDb,
  createMasterDb,
  hermezDailyBrief,
  hermezAuditLog,
  hermezConfig,
} from "@ykp/schema";
import { generateBriefForDate } from "@ykp/engine/hermez-brief";
import { sendTelegramMessage } from "@ykp/engine/telegram";
import { resolveTelegramCredentials } from "@ykp/engine/integrations";
import { todayWib } from "@ykp/engine/client";
import { eq } from "drizzle-orm";
import { requireSuperAdmin, fail, ok, mapAuthError } from "../_helpers";

export const dynamic = "force-dynamic";

/**
 * POST /api/hermez/run { date?, sync?, force?, send? } — async brief generation.
 *
 * The brief takes ~28s (VERIFICATION_REPORT P1). Instead of holding the HTTP
 * request open, POST returns 202 + job_id immediately and runs the generation
 * in the background; clients poll GET /api/hermez/run?date= or ?job_id=.
 *
 * Job state lives in hermez_config as KV rows (key `run_job:<date>`) so it
 * survives restarts and needs no migration. One job per date: re-POSTing the
 * same date while RUNNING returns the existing job (idempotent).
 *
 * On completion, the brief is auto-sent via Telegram (send !== false) unless
 * already sentToOwner — same behavior as the sync path.
 *
 * Escape hatches:
 *   - { sync: true }  → legacy synchronous behavior (cron-style tooling)
 *   - { force: true } → ignore a DONE job and regenerate
 *   - { send: false } → skip Telegram auto-send
 */

type JobStatus = "RUNNING" | "DONE" | "FAILED" | "STALE";

interface TelegramOutcome {
  attempted: boolean;
  sent: boolean;
  skipped?: string;
  messageId?: number;
  error?: string;
}

interface RunJob {
  job_id: string;
  date: string;
  status: JobStatus;
  started_at: string;
  finished_at?: string;
  result?: { brief_id: string; alert_count: number; level: string };
  telegram?: TelegramOutcome;
  error?: string;
}

const STALE_AFTER_MS = 10 * 60 * 1000; // RUNNING > 10 min = crashed worker

function jobKey(date: string): string {
  return `run_job:${date}`;
}

function toJobId(date: string): string {
  return `RUN-${date.replace(/-/g, "")}`;
}

async function readJob(hermezDb: ReturnType<typeof createHermezDb>, date: string): Promise<RunJob | null> {
  const rows = await hermezDb
    .select({ value: hermezConfig.value })
    .from(hermezConfig)
    .where(eq(hermezConfig.key, jobKey(date)))
    .limit(1);
  if (!rows.length) return null;
  try {
    return JSON.parse(rows[0].value) as RunJob;
  } catch {
    return null;
  }
}

async function writeJob(hermezDb: ReturnType<typeof createHermezDb>, job: RunJob): Promise<void> {
  const now = new Date();
  await hermezDb
    .insert(hermezConfig)
    .values({
      configId: jobKey(job.date),
      key: jobKey(job.date),
      value: JSON.stringify(job),
      label: "Hermez run job",
      isActive: true,
      updatedAt: now,
      updatedBy: "run-route",
    })
    .onConflictDoUpdate({
      target: hermezConfig.key,
      set: { value: JSON.stringify(job), updatedAt: now, updatedBy: "run-route" },
    });
}

function isStale(job: RunJob): boolean {
  return job.status === "RUNNING" && Date.now() - new Date(job.started_at).getTime() > STALE_AFTER_MS;
}

/** Auto-send the brief via Telegram unless already sent. Shared by sync + async paths. */
async function autoSendBrief(
  hermezDb: ReturnType<typeof createHermezDb>,
  briefId: string,
  briefText: string,
  shouldSend: boolean,
  actor: string,
  reason: string,
): Promise<TelegramOutcome> {
  // Re-read brief so we honor DB-preserved sentToOwner on upsert (Z7).
  const rows = await hermezDb
    .select()
    .from(hermezDailyBrief)
    .where(eq(hermezDailyBrief.briefId, briefId))
    .limit(1);
  const brief = rows[0];

  if (brief?.sentToOwner) return { attempted: false, sent: true, skipped: "already_sent" };
  if (!shouldSend) return { attempted: false, sent: false, skipped: "send_disabled" };

  const { token, chatId } = await resolveTelegramCredentials();
  if (!token || !chatId) return { attempted: false, sent: false, skipped: "missing_token_or_chat_id" };

  const tg = await sendTelegramMessage(token, chatId, briefText, "group");
  await hermezDb.insert(hermezAuditLog).values({
    actor,
    action: "telegram.send",
    entity: "hermez_daily_brief",
    entityId: briefId,
    after: { ok: tg.ok, messageId: tg.ok ? tg.messageId : null, error: tg.ok ? null : tg.error },
    reason,
  });
  if (tg.ok) {
    await hermezDb
      .update(hermezDailyBrief)
      .set({ sentToOwner: true, sentAt: new Date() })
      .where(eq(hermezDailyBrief.briefId, briefId));
    return { attempted: true, sent: true, messageId: tg.messageId };
  }
  return { attempted: true, sent: false, error: tg.error };
}

/** Fire-and-forget generation; job row is updated on completion. */
function startBackgroundRun(date: string, job: RunJob, shouldSend: boolean, isCron: boolean): void {
  const hermezDb = createHermezDb();
  const hrDb = createHrDb();
  const financeDb = createFinanceDb();
  const masterDb = createMasterDb();

  generateBriefForDate({ hermezDb, hrDb, financeDb, masterDb, date })
    .then(async (result) => {
      const telegram = await autoSendBrief(
        hermezDb,
        result.brief.briefId,
        result.brief.briefText,
        shouldSend,
        isCron ? "cron" : "run-console",
        isCron ? "cron-secret" : "manual-run-bg",
      ).catch(() => ({ attempted: false, sent: false, error: "auto-send failed" } as TelegramOutcome));
      await writeJob(hermezDb, {
        ...job,
        status: "DONE",
        finished_at: new Date().toISOString(),
        result: {
          brief_id: result.brief.briefId,
          alert_count: result.alerts.length,
          level: result.brief.alertLevel,
        },
        telegram,
      });
    })
    .catch(async (e) => {
      if (process.env.NODE_ENV !== "production") console.error("[hermez run bg]", e);
      await writeJob(hermezDb, {
        ...job,
        status: "FAILED",
        finished_at: new Date().toISOString(),
        error: e instanceof Error ? e.message : String(e),
      }).catch(() => null);
    });
}

export async function POST(req: Request) {
  // CRON_SECRET bypass: if header matches env, skip role check (cron worker).
  const cronSecret = process.env.HERMEZ_CRON_SECRET ?? process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  const isCron = cronSecret && headerSecret === cronSecret;

  if (!isCron) {
    try {
      await requireSuperAdmin();
    } catch (err) {
      return mapAuthError(err);
    }
  }

  const body = (await req.json().catch(() => ({}))) as { date?: string; sync?: boolean; force?: boolean; send?: boolean };
  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayWib();
  const shouldSend = body.send !== false; // default true

  const hermezDb = createHermezDb();

  // Legacy synchronous path (explicit opt-in; used by tooling that needs the
  // result in one shot). Includes the Telegram auto-send.
  if (body.sync) {
    try {
      const result = await generateBriefForDate({
        hermezDb,
        hrDb: createHrDb(),
        financeDb: createFinanceDb(),
        masterDb: createMasterDb(),
        date,
      });
      const telegram = await autoSendBrief(
        hermezDb,
        result.brief.briefId,
        result.brief.briefText,
        shouldSend,
        isCron ? "cron" : "run-console",
        isCron ? "cron-secret" : "manual-run",
      );
      return ok({
        brief_id: result.brief.briefId,
        date,
        alert_count: result.alerts.length,
        level: result.brief.alertLevel,
        telegram,
      });
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.error("[hermez run]", e);
      return fail("server", "Internal server error", 500);
    }
  }

  // Async path (default).
  const existing = await readJob(hermezDb, date);
  if (existing) {
    if (isStale(existing)) {
      const stale: RunJob = { ...existing, status: "STALE", finished_at: new Date().toISOString(), error: "worker timed out" };
      await writeJob(hermezDb, stale).catch(() => null);
    } else if (existing.status === "RUNNING") {
      return ok(existing, 202);
    } else if (existing.status === "DONE" && !body.force) {
      return ok(existing, 200);
    }
  }

  const job: RunJob = {
    job_id: toJobId(date),
    date,
    status: "RUNNING",
    started_at: new Date().toISOString(),
  };
  await writeJob(hermezDb, job);
  startBackgroundRun(date, job, shouldSend, Boolean(isCron));
  return ok(job, 202);
}

/**
 * GET /api/hermez/run?date=YYYY-MM-DD (or ?job_id=RUN-YYYYMMDD)
 * Poll endpoint for the async job. Returns the job record; when status is
 * DONE the `result` field carries brief_id/alert_count/level and `telegram`
 * carries the auto-send outcome.
 */
export async function GET(req: Request) {
  try {
    await requireSuperAdmin();
  } catch (err) {
    return mapAuthError(err);
  }

  const url = new URL(req.url);
  let date = url.searchParams.get("date") ?? "";
  const jobId = url.searchParams.get("job_id") ?? "";
  if (!date && jobId.startsWith("RUN-")) {
    const raw = jobId.slice(4); // YYYYMMDD
    date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("validation", "date or job_id required", 400);

  const hermezDb = createHermezDb();
  const job = await readJob(hermezDb, date);
  if (!job) return fail("not_found", `No run job for ${date}`, 404);

  if (isStale(job)) {
    const stale: RunJob = { ...job, status: "STALE", finished_at: new Date().toISOString(), error: "worker timed out" };
    await writeJob(hermezDb, stale).catch(() => null);
    return ok(stale);
  }
  return ok(job);
}
