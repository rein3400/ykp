/**
 * HR app middleware — CSP / CORS / rate-limit (Defect 14 fix).
 *
 * - CSP: locked-down defaults; styleSrc allows 'unsafe-inline' for Tailwind.
 * - CORS: allowlist from CORS_ORIGIN env (comma-separated). Same-origin
 *   requests always pass.
 * - Rate limit: in-memory token bucket per IP. Tiers (env-overridable):
 *     RATE_LIMIT_DEFAULT   (default 120/min) — page walks fire several API
 *                          calls per page; 30/min caused 429s on a normal
 *                          10-page walkthrough (VERIFICATION_REPORT P2).
 *     RATE_LIMIT_SENSITIVE (default 5/min)  — import, run, telegram-test.
 *     RATE_LIMIT_AUTH      (default 10/min) — login brute-force guard.
 *   Multi-instance deploys would need Redis-backed bucket; documented in plan R6.
 */
import { NextResponse, type NextRequest } from "next/server";

const ALLOW_ORIGINS = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SENSITIVE_PATHS = ["/api/hr/payroll/generate", "/api/hr/employees/import"];
const AUTH_PATHS = ["/api/auth/login"];
const HEALTH_PATHS = ["/health", "/api/health"];

const TOKEN_BUCKET = new Map<string, { tokens: number; ts: number }>();
const LIMIT_DEFAULT = Number(process.env.RATE_LIMIT_DEFAULT ?? 120);
const LIMIT_SENSITIVE = Number(process.env.RATE_LIMIT_SENSITIVE ?? 5);
const LIMIT_AUTH = Number(process.env.RATE_LIMIT_AUTH ?? 10);
const WINDOW_MS = 60_000;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.ip ||
    "unknown"
  );
}

function allowRequest(ip: string, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = TOKEN_BUCKET.get(ip);
  if (!entry) {
    TOKEN_BUCKET.set(ip, { tokens: limit - 1, ts: now });
    return { allowed: true, remaining: limit - 1 };
  }
  const elapsed = now - entry.ts;
  if (elapsed > WINDOW_MS) {
    TOKEN_BUCKET.set(ip, { tokens: limit - 1, ts: now });
    return { allowed: true, remaining: limit - 1 };
  }
  if (entry.tokens <= 0) return { allowed: false, remaining: 0 };
  entry.tokens -= 1;
  return { allowed: true, remaining: entry.tokens };
}

function isSensitivePath(pathname: string): boolean {
  return SENSITIVE_PATHS.some((p) => pathname.startsWith(p));
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname.startsWith(p));
}

function isHealthPath(pathname: string): boolean {
  return HEALTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function limitFor(pathname: string): number {
  if (isSensitivePath(pathname)) return LIMIT_SENSITIVE;
  if (isAuthPath(pathname)) return LIMIT_AUTH;
  return LIMIT_DEFAULT;
}

function buildCsp(): string {
  // Allow the YKP Hub portal to embed this app in an iframe (preview).
  // CORS_ORIGIN is the Hub origin. If unset, frame-ancestors stays 'none'.
  const hubOrigins = (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const frameAncestors = hubOrigins.length ? `frame-ancestors 'self' ${hubOrigins.join(" ")}` : "frame-ancestors 'none'";
  return [
    "default-src 'self'",
    // Next.js 14 hydrates via inline scripts that get blocked by strict CSP.
    // 'unsafe-inline' is required for client component interactivity (buttons,
    // forms, dialogs). Internal apps only — not exposed to untrusted content.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https:",
    frameAncestors,
  ].join("; ");
}

function applyCors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get("origin");
  if (!origin) return res;
  if (ALLOW_ORIGINS.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization,x-api-key,x-telegram-id");
  }
  return res;
}

export function middleware(req: NextRequest) {
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    return applyCors(req, res);
  }

  const pathname = req.nextUrl.pathname;
  if (isHealthPath(pathname)) {
    const res = NextResponse.next();
    res.headers.set("Content-Security-Policy", buildCsp());
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return applyCors(req, res);
  }

  const limit = limitFor(pathname);
  const ip = clientIp(req);
  const { allowed, remaining } = allowRequest(ip, limit);
  if (!allowed) {
    return new NextResponse(
      JSON.stringify({
        error: {
          code: "rate_limited",
          message: `Too many requests — limit ${limit}/min. Coba lagi sebentar.`,
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + 60),
        },
      },
    );
  }

  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(limit));
  res.headers.set("X-RateLimit-Remaining", String(remaining));
  res.headers.set("X-RateLimit-Reset", String(Math.ceil(Date.now() / 1000) + 60));
  res.headers.set("Content-Security-Policy", buildCsp());
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return applyCors(req, res);
}

export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};