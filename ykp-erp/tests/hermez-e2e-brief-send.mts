/* End-to-end Hermez cron simulation: generateBriefForDate -> sendTelegramMessage.
 * Mirrors brief-cron.ts worker logic but without BullMQ/Redis, so we can
 * verify the full generate+notify integration against the live DB + Telegram.
 *
 * Run: npx tsx tests/hermez-e2e-brief-send.mts 2026-07-15 [channel]
 *   channel: "owner" (default) | "group"
 *
 * Env: YKP_*_DATABASE_URL, TELEGRAM_BOT_TOKEN, OWNER_CHAT_ID
 */
import { initDbClients, createHermezDb, createHrDb, createFinanceDb, createMasterDb, hermezDailyBrief } from "../packages/schema/src";
import { generateBriefForDate } from "../packages/engine/src/hermez-brief";
import { sendTelegramMessage } from "../packages/engine/src/telegram";
import { eq } from "drizzle-orm";

const date = process.argv[2] ?? "2026-07-15";
const channel = (process.argv[3] ?? "owner") as "owner" | "group";

async function main() {
  initDbClients();
  const hermezDb = createHermezDb();

  console.log(`[e2e] generating brief for ${date} ...`);
  const result = await generateBriefForDate({
    hermezDb,
    hrDb: createHrDb(),
    financeDb: createFinanceDb(),
    masterDb: createMasterDb(),
    date,
  });
  console.log(`[e2e] generated ${result.brief.briefId} alerts=${result.alerts.length} level=${result.brief.alertLevel}`);

  const token = process.env.HERMEZ_TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN ?? "";
  const chatId = process.env.OWNER_CHAT_ID ?? process.env.TELEGRAM_OWNER_CHAT_ID ?? "";
  if (!token || !chatId) {
    console.error("[e2e] missing TELEGRAM_BOT_TOKEN or OWNER_CHAT_ID");
    process.exit(1);
  }
  console.log(`[e2e] sending to chat=${chatId} channel=${channel} ...`);
  const tg = await sendTelegramMessage(token, chatId, result.brief.briefText, channel);
  if (tg.ok) {
    console.log(`[e2e] sent messageId=${tg.messageId}`);
    // Mirror cron worker: mark sentToOwner=true + sentAt
    await hermezDb
      .update(hermezDailyBrief)
      .set({ sentToOwner: true, sentAt: new Date() })
      .where(eq(hermezDailyBrief.briefId, result.brief.briefId));
    console.log(`[e2e] marked sentToOwner=true`);
  } else {
    console.error(`[e2e] send failed: ${tg.error}`);
    process.exit(1);
  }
  process.exit(0);
}

void main().catch((e) => {
  console.error("[e2e] fatal", e);
  process.exit(1);
});