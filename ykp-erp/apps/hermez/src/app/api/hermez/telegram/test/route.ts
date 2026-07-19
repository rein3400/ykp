import { sendTelegramMessage } from "@ykp/engine/telegram";
import { resolveTelegramCredentials } from "@ykp/engine/integrations";
import { createHermezDb, hermezAuditLog } from "@ykp/schema";
import { requireSuperAdmin, fail, ok, mapAuthError } from "../../_helpers";

export const dynamic = "force-dynamic";

interface TestPayload {
  message?: string;
}

/**
 * POST /api/hermez/telegram/test { message }
 * Sends a test message to the owner chat via engine.sendTelegramMessage.
 * Requires SUPER_ADMIN. Returns { sent: bool, ... }.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireSuperAdmin();
  } catch (err) {
    return mapAuthError(err);
  }

  let body: TestPayload;
  try {
    body = (await req.json().catch(() => ({}))) as TestPayload;
  } catch {
    return fail("validation", "Invalid JSON body", 400);
  }

  const message = typeof body.message === "string" ? body.message : "";
  if (message.length === 0) {
    return fail("validation", "message is required", 400);
  }
  if (message.length > 4096) {
    return fail("validation", `message too long (${message.length} > 4096)`, 400);
  }

  const { token, chatId } = await resolveTelegramCredentials();
  if (!token || !chatId) {
    return fail(
      "missing-ref",
      "Telegram bot token / chat ID belum di-set. Isi via Konfigurasi → Integrasi, atau set env TELEGRAM_BOT_TOKEN / OWNER_CHAT_ID.",
      400,
    );
  }

  try {
    const result = await sendTelegramMessage(token, chatId, message);
    const db = createHermezDb();
    await db.insert(hermezAuditLog).values({
      actor: user.email,
      action: "telegram.test",
      entity: "telegram",
      entityId: "test",
      after: { ok: result.ok, messageId: result.ok ? result.messageId : null, error: result.ok ? null : result.error },
      reason: "Manual test send",
    });
    if (result.ok) {
      return ok({ sent: true, messageId: result.messageId });
    }
    return ok({ sent: false, error: result.error });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[hermez telegram test]", e);
    }
    return fail("server", "Internal server error", 500);
  }
}