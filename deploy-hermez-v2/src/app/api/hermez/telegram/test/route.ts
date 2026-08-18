import { sendTelegramMessage } from "../../../../../../_packages/engine/src";
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
  void user;

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

  const token =
    process.env.HERMEZ_TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN ?? "";
  const chatId = process.env.OWNER_CHAT_ID ?? process.env.TELEGRAM_OWNER_CHAT_ID ?? "";
  if (!token || !chatId) {
    return fail("missing-ref", "TELEGRAM_BOT_TOKEN or OWNER_CHAT_ID not set", 400);
  }

  try {
    const result = await sendTelegramMessage(token, chatId, message);
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