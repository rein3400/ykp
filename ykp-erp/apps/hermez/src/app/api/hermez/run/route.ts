import {
  createHermezDb,
  createHrDb,
  createFinanceDb,
  createMasterDb,
  hermezDailyBrief,
  hermezAuditLog,
} from "@ykp/schema";
import { generateBriefForDate } from "@ykp/engine/hermez-brief";
import { sendTelegramMessage } from "@ykp/engine/telegram";
import { resolveTelegramCredentials } from "@ykp/engine/integrations";
import { todayWib } from "@ykp/engine/client";
import { eq } from "drizzle-orm";
import { requireSuperAdmin, fail, ok, mapAuthError } from "../_helpers";

export const dynamic = "force-dynamic";

interface RunPayload {
  date?: string;
  /** When true (default), send brief to Telegram if not already sent. */
  send?: boolean;
}

/**
 * POST /api/hermez/run { date?, send? }
 * Triggers generateBriefForDate for the given date (defaults to today WIB),
 * then auto-sends the brief via Telegram to OWNER_CHAT_ID when not yet sent.
 * Requires SUPER_ADMIN. CRON_SECRET-protected when called via cron: the
 * caller may set `x-cron-secret` header to bypass role check.
 */
export async function POST(req: Request) {
  // CRON_SECRET bypass: if header matches env, skip role check (cron worker).
  const cronSecret = process.env.HERMEZ_CRON_SECRET ?? process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  const isCron = Boolean(cronSecret && headerSecret === cronSecret);

  if (!isCron) {
    try {
      await requireSuperAdmin();
    } catch (err) {
      return mapAuthError(err);
    }
  }

  let body: RunPayload = {};
  try {
    body = (await req.json().catch(() => ({}))) as RunPayload;
  } catch {
    // empty body is fine — default date below
  }

  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayWib();
  const shouldSend = body.send !== false; // default true

  const hermezDb = createHermezDb();
  const hrDb = createHrDb();
  const financeDb = createFinanceDb();
  const masterDb = createMasterDb();

  try {
    const result = await generateBriefForDate({
      hermezDb,
      hrDb,
      financeDb,
      masterDb,
      date,
    });

    // Re-read brief so we honor DB-preserved sentToOwner on upsert (Z7).
    const rows = await hermezDb
      .select()
      .from(hermezDailyBrief)
      .where(eq(hermezDailyBrief.briefId, result.brief.briefId))
      .limit(1);
    const brief = rows[0] ?? result.brief;

    let telegram: {
      attempted: boolean;
      sent: boolean;
      skipped?: string;
      messageId?: number;
      error?: string;
    } = { attempted: false, sent: Boolean(brief.sentToOwner) };

    if (shouldSend && !brief.sentToOwner) {
      const { token, chatId } = await resolveTelegramCredentials();
      if (!token || !chatId) {
        telegram = { attempted: false, sent: false, skipped: "missing_token_or_chat_id" };
      } else {
        telegram = { attempted: true, sent: false };
        const tg = await sendTelegramMessage(token, chatId, brief.briefText, "group");
        await hermezDb.insert(hermezAuditLog).values({
          actor: isCron ? "cron" : "run-console",
          action: "telegram.send",
          entity: "hermez_daily_brief",
          entityId: brief.briefId,
          after: {
            ok: tg.ok,
            messageId: tg.ok ? tg.messageId : null,
            error: tg.ok ? null : tg.error,
          },
          reason: isCron ? "cron-secret" : "manual-run",
        });
        if (tg.ok) {
          await hermezDb
            .update(hermezDailyBrief)
            .set({ sentToOwner: true, sentAt: new Date() })
            .where(eq(hermezDailyBrief.briefId, brief.briefId));
          telegram = { attempted: true, sent: true, messageId: tg.messageId };
        } else {
          telegram = { attempted: true, sent: false, error: tg.error };
        }
      }
    } else if (brief.sentToOwner) {
      telegram = { attempted: false, sent: true, skipped: "already_sent" };
    } else if (!shouldSend) {
      telegram = { attempted: false, sent: false, skipped: "send_disabled" };
    }

    return ok({
      brief_id: result.brief.briefId,
      date,
      alert_count: result.alerts.length,
      level: result.brief.alertLevel,
      telegram,
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[hermez run]", e);
    }
    return fail("server", "Internal server error", 500);
  }
}