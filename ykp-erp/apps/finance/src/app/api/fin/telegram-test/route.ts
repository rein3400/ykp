/**
 * POST /api/fin/telegram-test {message}
 *
 * Sends a test Telegram message through @ykp/engine sendTelegramMessage.
 * Owner / Super Admin / Finance Admin only. Useful for verifying that
 * the bot token + chat id env vars are wired correctly from Settings.
 *
 * sendTelegramMessage signature: (token, chatId, text) -> { ok, messageId }.
 * Returns ok:false with a typed error string on any failure, so we surface
 * that string rather than throwing — a misconfigured bot is a config error,
 * not a 500.
 */
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { handler, ok, fail } from "@finance/lib/server/http";
import { getFinanceDb } from "@finance/lib/server/db";
import { logFinanceAudit } from "@finance/lib/server/audit";
import { sendTelegramMessage } from "@ykp/engine/telegram";
import { z } from "zod";

const Body = z.object({
  message: z.string().min(1).max(1024),
});

export const POST = handler(async (req: Request) => {
  const user = await requireRole([Role.OWNER, Role.SUPER_ADMIN, Role.FINANCE_ADMIN]);
  const body = await req.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid body", parsed.error.flatten());

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.OWNER_CHAT_ID;
  if (!token || !chatId) {
    return fail("bad_request", "TELEGRAM_BOT_TOKEN / OWNER_CHAT_ID not configured on the server");
  }

  try {
    const result = await sendTelegramMessage(token, chatId, parsed.data.message);
    const financeDb = getFinanceDb();
    await logFinanceAudit(financeDb, {
      actor: user.id,
      action: "telegram:test",
      entity: "telegram",
      entityId: "test",
      after: { ok: result.ok, messageId: result.ok ? result.messageId : null, error: result.ok ? null : result.error },
      reason: "Manual test send",
    });
    if (!result.ok) {
      // Defect 10b: never leak provider error body / token info to caller.
      // Log the detail server-side for ops triage.
      console.error("[telegram-test] send failed", { error: result.error });
      return fail("internal_error", "Telegram send failed");
    }
    return ok({ sent: true, ok: true, message_id: result.messageId, sent_by: user.id });
  } catch (e) {
    // Same: log detail, return fixed message.
    console.error("[telegram-test] exception", e);
    return fail("internal_error", "Telegram send failed");
  }
});