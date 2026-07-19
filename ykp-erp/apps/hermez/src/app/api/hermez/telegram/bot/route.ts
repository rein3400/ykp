import { getBotStatus, startTelegramBot, stopTelegramBot } from "@ykp/engine/telegram-bot";
import { requireSuperAdmin, ok, mapAuthError } from "../../_helpers";

export const dynamic = "force-dynamic";

/**
 * GET  /api/hermez/telegram/bot — bot status (running, mode, stats).
 * POST /api/hermez/telegram/bot { action: "start" | "stop" | "status" }
 * Starts/stops the in-process polling bot. Requires SUPER_ADMIN.
 */
export async function GET() {
  try {
    await requireSuperAdmin();
  } catch (err) {
    return mapAuthError(err);
  }
  return ok({ bot: getBotStatus() });
}

interface PostPayload {
  action?: string;
}

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
  } catch (err) {
    return mapAuthError(err);
  }

  let body: PostPayload = {};
  try {
    body = (await req.json().catch(() => ({}))) as PostPayload;
  } catch {
    body = {};
  }

  if (body.action === "start") {
    const res = await startTelegramBot();
    return ok({ ...res, bot: getBotStatus() });
  }
  if (body.action === "stop") {
    const res = stopTelegramBot();
    return ok({ ...res, bot: getBotStatus() });
  }
  return ok({ bot: getBotStatus() });
}
