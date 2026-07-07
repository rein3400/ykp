/**
 * @ykp/auth/session
 *
 * Cookie-based session helpers. **Stub implementation** — Clerk will
 * replace the read/write surface in v2. The shape of SessionUser stays
 * the same so consuming apps don't need to change.
 *
 * Cookie format: signed JWT (HS256 using NEXTAUTH_SECRET, via Node's
 * built-in crypto so no extra runtime deps are pulled). The browser
 * never writes a session cookie (avoids forgeable client-side writes).
 */

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import type { SessionUser } from "./rbac.js";

export const SESSION_COOKIE_NAME = "ykp_session";
/** 24 hours max, binding contract §6. */
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24;

function getSecret(): Buffer {
  const key = process.env.NEXTAUTH_SECRET;
  if (!key || key.length < 32) {
    throw new Error("NEXTAUTH_SECRET must be at least 32 characters for HS256 session signing");
  }
  return Buffer.from(key, "utf8");
}

function b64urlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(input: string, secret: Buffer): string {
  return b64urlEncode(createHmac("sha256", secret).update(input).digest());
}

/** Sign a SessionUser into a compact JWS (HS256). */
export function signSession(user: SessionUser): string {
  const secret = getSecret();
  const header = b64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload: Record<string, unknown> = {
    ...user,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_COOKIE_MAX_AGE,
    jti: randomBytes(8).toString("hex"),
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = sign(`${header}.${body}`, secret);
  return `${header}.${body}.${sig}`;
}

/** Verify a compact JWS (HS256) and return the SessionUser if valid. */
export function verifySession(token: string): SessionUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = sign(`${header}.${body}`, getSecret());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    const { iat: _iat, exp: _exp, jti: _jti, ...rest } = payload;
    return rest as unknown as SessionUser;
  } catch {
    return null;
  }
}

export interface SessionReadResult {
  user: SessionUser | null;
  /** True when cookie exists but signature/parse failed; caller should clear it. */
  invalid: boolean;
}

/**
 * Read a session user from the request/response cookie store.
 * Works in both Next.js route handlers and browser contexts.
 */
export async function getSession(): Promise<SessionReadResult> {
  let raw: string | undefined;
  try {
    if (typeof window === "undefined") {
      const { cookies } = await import("next/headers");
      raw = cookies().get(SESSION_COOKIE_NAME)?.value;
    } else {
      raw = document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
        ?.split("=")[1];
    }
  } catch {
    return { user: null, invalid: false };
  }
  if (!raw) return { user: null, invalid: false };
  const user = verifySession(raw);
  return { user, invalid: user === null };
}

/**
 * Persist a session. Server-side only — the browser is not allowed to
 * mint or write session cookies. Uses httpOnly, strict SameSite, and
 * secure in production.
 */
export async function setSession(user: SessionUser): Promise<void> {
  if (typeof window !== "undefined") {
    throw new Error("setSession must only be called server-side");
  }
  const { cookies } = await import("next/headers");
  const value = signSession(user);
  cookies().set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  if (typeof window !== "undefined") {
    throw new Error("clearSession must only be called server-side");
  }
  const { cookies } = await import("next/headers");
  cookies().delete(SESSION_COOKIE_NAME);
}