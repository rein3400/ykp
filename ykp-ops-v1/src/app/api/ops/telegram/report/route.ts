import { handler, fail, unauthorized } from "@/lib/http";
import { timingSafeEqual } from "node:crypto";
export const POST = handler(async (request) => {
  const secret = process.env.TELEGRAM_BOT_SECRET ?? "";
  const header = request.headers.get("x-bot-secret") ?? "";
  if (
    !secret ||
    Buffer.byteLength(secret) !== Buffer.byteLength(header) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(header))
  )
    return unauthorized();
  return fail(
    "gone",
    "Gunakan webhook bot Ops dengan identitas pengirim pribadi dan menu native. Endpoint laporan lama dinonaktifkan.",
    410,
  );
});
