import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "ykp_hub_session";

function secret(): string {
  const s = process.env.HUB_SESSION_SECRET ?? process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("HUB_SESSION_SECRET (or SESSION_SECRET) must be set (>=32 chars)");
  }
  return s;
}

function b64urlJson(seg: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(seg, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Validate the hub session cookie and return the session it carries. */
export async function GET(req: Request) {
  const header = new Headers(req.headers).get("cookie") ?? "";
  const token = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!token) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Belum login" } }, { status: 401 });
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sesi tidak valid" } }, { status: 401 });
  }
  const [h, b, sig] = parts;
  const expect = createHmac("sha256", secret()).update(`${h}.${b}`).digest("base64url");
  const a = Buffer.from(sig);
  const c = Buffer.from(expect);
  if (a.length !== c.length || !timingSafeEqual(a, c)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sesi tidak valid" } }, { status: 401 });
  }
  const payload = b64urlJson(b);
  const exp = typeof payload?.exp === "number" ? payload.exp : 0;
  if (!payload || Date.now() / 1000 > exp) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sesi kedaluwarsa" } }, { status: 401 });
  }
  return NextResponse.json({
    data: {
      username: String(payload.username ?? ""),
      role: String(payload.role ?? "VIEWER"),
      userId: String(payload.userId ?? payload.username ?? "")
    }
  });
}
