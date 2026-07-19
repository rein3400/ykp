/**
 * Hub login proxy. Forwards credentials to the local HR app (shared user
 * store) so the browser doesn't hit a cross-origin POST (CORS).
 *
 * Server-to-server: same machine, no CORS preflight issues.
 * Hub session cookie is issued locally (HS256-signed) for the hub UI only;
 * the upstream HR cookie is forwarded for cross-app SSO convenience.
 * Upstream base URL comes from app/config (NEXT_PUBLIC_YKP_HR_URL).
 */
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { findHubModule, moduleBaseUrl } from "../../../config";

const HR_MODULE = findHubModule("hr");
const UPSTREAM_LOGIN = `${HR_MODULE ? moduleBaseUrl(HR_MODULE) : "http://localhost:3002"}/api/auth/login`;

const COOKIE_NAME = "ykp_hub_session";
const COOKIE_MAX_AGE = 24 * 3600;

function secret(): string {
  const s = process.env.HUB_SESSION_SECRET ?? process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("HUB_SESSION_SECRET (or SESSION_SECRET) must be set (>=32 chars)");
  }
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** HS256 sign compact JWS. Used for the hub's own session cookie. */
function sign(payload: object): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON body" } }, { status: 400 });
  }

  const { username, password } = (body ?? {}) as { username?: string; password?: string };
  if (!username || !password) {
    return NextResponse.json({ error: { code: "bad_request", message: "username dan password wajib" } }, { status: 400 });
  }

  // Forward to upstream
  let upstreamResp: Response;
  try {
    upstreamResp = await fetch(UPSTREAM_LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
  } catch (e) {
    return NextResponse.json(
      { error: { code: "upstream_unreachable", message: "Tidak dapat menghubungi upstream" } },
      { status: 502 }
    );
  }

  const text = await upstreamResp.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!upstreamResp.ok) {
    const msg = (payload as { error?: { message?: string } })?.error?.message ?? "Login gagal";
    return NextResponse.json({ error: { code: "unauthorized", message: msg } }, { status: upstreamResp.status });
  }

  const data = (payload as { data?: { userId?: string; role?: string } }).data;
  const role = (data?.role ?? "VIEWER").toString().toUpperCase();
  const userId = data?.userId ?? username;

  const now = Math.floor(Date.now() / 1000);
  const token = sign({ username, role, userId, iat: now, exp: now + COOKIE_MAX_AGE });

  const res = NextResponse.json({ data: { username, role, userId } });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE
  });
  return res;
}