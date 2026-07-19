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
    // When the dedicated bot worker service is enabled, the web process must
    // NOT also poll — two getUpdates consumers on one token split updates.
    if (process.env.HERMEZ_BOT_WORKER_ENABLED === "true") {
      return ok({
        started: false,
        reason: "managed_by_worker_service",
        note: "Bot polling runs in the dedicated ykp-erp-hermez-bot worker. This web process only sends outbound messages.",
        bot: getBotStatus(),
      });
    }
    const res = await startTelegramBot();
    return ok({ ...res, bot: getBotStatus() });
  }
  if (body.action === "stop") {
    const res = stopTelegramBot();
    return ok({ ...res, bot: getBotStatus() });
  }
  return ok({ bot: getBotStatus() });
}
