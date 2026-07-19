/**
 * Hermez brief cron worker.
 *
 * If REDIS_URL is set, registers BullMQ repeatable jobs at HERMEZ_RUN_HOUR_UTC
 * and workers that generate the brief for today WIB, then send it via Telegram
 * if not already sent.
 */
import { initDbClients, createHermezDb, createHrDb, createFinanceDb, createMasterDb } from "@ykp/schema";
import { HERMEZ_RUN_HOUR_UTC } from "@ykp/config";
import { todayWib } from "@ykp/engine/client";
import { generateBriefForDate } from "@ykp/engine/hermez-brief";
import { scheduleHermezCron, makeBriefWorker, makeRetryWorker } from "@ykp/engine/cron";
import { sendTelegramMessage } from "@ykp/engine/telegram";
import { resolveTelegramCredentials } from "@ykp/engine/integrations";
import { eq } from "drizzle-orm";
import { hermezDailyBrief, hermezAuditLog } from "@ykp/schema";

initDbClients();

async function main() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("[hermez-cron] REDIS_URL not set — skipping cron registration.");
    return;
  }

  await scheduleHermezCron({ redisUrl, runHourUtc: HERMEZ_RUN_HOUR_UTC });

  const briefWorker = makeBriefWorker(redisUrl, async (job) => {
    const date = job.data.date || todayWib();
    const hermezDb = createHermezDb();
    const hrDb = createHrDb();
    const financeDb = createFinanceDb();
    const masterDb = createMasterDb();

    const result = await generateBriefForDate({
      hermezDb,
      hrDb,
      financeDb,
      masterDb,
      date,
    });

    const { token, chatId } = await resolveTelegramCredentials();
    if (token && chatId && !result.brief.sentToOwner) {
      const tg = await sendTelegramMessage(token, chatId, result.brief.briefText);
      await hermezDb.insert(hermezAuditLog).values({
        actor: "cron",
        action: "telegram.send",
        entity: "hermez_daily_brief",
        entityId: result.brief.briefId,
        after: { ok: tg.ok, messageId: tg.ok ? tg.messageId : null, error: tg.ok ? null : tg.error },
        reason: `cron-${job.data.triggeredBy}`,
      });
      if (tg.ok) {
        await hermezDb
          .update(hermezDailyBrief)
          .set({ sentToOwner: true, sentAt: new Date() })
          .where(eq(hermezDailyBrief.briefId, result.brief.briefId));
      }
    }

    await hermezDb.insert(hermezAuditLog).values({
      actor: "cron",
      action: "brief.generate",
      entity: "hermez_daily_brief",
      entityId: result.brief.briefId,
      after: { alertCount: result.alerts.length, level: result.brief.alertLevel, sent: result.brief.sentToOwner },
      reason: `cron-${job.data.triggeredBy}`,
    });
  });

  const retryWorker = makeRetryWorker(redisUrl, async (job) => {
    const date = job.data.date || todayWib();
    const hermezDb = createHermezDb();
    const briefId = `HZBR-${date.replace(/-/g, "")}`;
    const rows = await hermezDb
      .select()
      .from(hermezDailyBrief)
      .where(eq(hermezDailyBrief.briefId, briefId))
      .limit(1);
    const brief = rows[0];
    if (!brief) return;
    if (brief.sentToOwner) return;

    const { token, chatId } = await resolveTelegramCredentials();
    if (!token || !chatId) return;

    const tg = await sendTelegramMessage(token, chatId, brief.briefText);
    await hermezDb.insert(hermezAuditLog).values({
      actor: "cron",
      action: "telegram.send",
      entity: "hermez_daily_brief",
      entityId: briefId,
      after: { ok: tg.ok, messageId: tg.ok ? tg.messageId : null, error: tg.ok ? null : tg.error },
      reason: `retry-${job.data.triggeredBy}`,
    });
    if (tg.ok) {
      await hermezDb
        .update(hermezDailyBrief)
        .set({ sentToOwner: true, sentAt: new Date() })
        .where(eq(hermezDailyBrief.briefId, briefId));
    }
  });

  console.log(`[hermez-cron] Workers registered. Brief queue ready.`);

  process.on("SIGTERM", async () => {
    await briefWorker.close();
    await retryWorker.close();
    process.exit(0);
  });
}

void main().catch((e) => {
  console.error("[hermez-cron] failed:", e);
  process.exit(1);
});
