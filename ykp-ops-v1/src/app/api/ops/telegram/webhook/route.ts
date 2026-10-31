import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { mkdir, rmdir } from "node:fs/promises";
import { handler, ok, unauthorized, badRequest } from "@/lib/http";
import { consumeLinkCode } from "@/lib/telegram";
import { telegramBotToken } from "@/lib/bot-token";
import { routeOpsUpdate } from "@/lib/ops-telegram";
import { menuKeyboard } from "@/lib/telegram-forms";
import { nativeOpsMessage } from "@/lib/telegram-native";

function authorized(req: Request) {
  const secret = (process.env.TELEGRAM_OPS_WEBHOOK_SECRET ?? "").trim();
  const header = (
    req.headers.get("x-telegram-bot-api-secret-token") ?? ""
  ).trim();
  return (
    Boolean(secret) &&
    Buffer.byteLength(secret) === Buffer.byteLength(header) &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(header))
  );
}
async function reply(
  chatId: string,
  text: string,
  keyboard?: ReturnType<typeof menuKeyboard>,
) {
  const token = telegramBotToken();
  if (!token) throw new Error("Ops bot token unavailable");
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4000),
        parse_mode: "HTML",
        reply_markup: keyboard,
      }),
      signal: AbortSignal.timeout(12000),
    },
  );
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw new Error("Telegram reply delivery failed");
}
export const POST = handler(async (req: NextRequest) => {
  if (!authorized(req)) return unauthorized("Invalid webhook secret");
  const update = await req.json().catch(() => null);
  const message = update?.message;
  if (!message) return ok({ ignored: true });
  if (
    !Number.isSafeInteger(update.update_id) ||
    !Number.isSafeInteger(message.chat?.id) ||
    !Number.isSafeInteger(message.from?.id)
  )
    return badRequest("Invalid update identity");
  const chatId = String(message.chat.id),
    senderId = String(message.from.id);
  if (message.chat.type !== "private" || chatId !== senderId) {
    return ok({ ignored: true, reason: "private_chat_required" });
  }
  const text = typeof message.text === "string" ? message.text : "";
  const route = routeOpsUpdate(text);
  if (route.kind === "link") {
    const user = await consumeLinkCode(route.code, senderId);
    await reply(
      chatId,
      user
        ? "Akun Operasional berhasil terhubung. Pilih menu di bawah."
        : "Kode tidak valid/kedaluwarsa. Buat kode baru di Ops → Telegram.",
      menuKeyboard(),
    );
    return ok({ handled: true });
  }
  if (!text) {
    await reply(
      chatId,
      "Kirim jawaban teks atau URL foto HTTPS sesuai pertanyaan. Upload foto langsung belum didukung; jangan kirim token bot.",
      menuKeyboard(),
    );
    return ok({ handled: true });
  }
  const lock = "/tmp/ykp-ops-telegram-processor.lock";
  try {
    await mkdir(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error("Telegram processor busy; retry required");
    throw error;
  }
  try {
    const result = await nativeOpsMessage({
      chatId,
      senderId,
      updateId: update.update_id,
      text,
    });
    await reply(chatId, result.text, result.keyboard);
  } finally {
    await rmdir(lock);
  }
  return ok({ handled: true });
});
