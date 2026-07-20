/**
 * Hermez app middleware — CSP / CORS / rate-limit (Defect 14 fix).
 * See apps/hr/src/middleware.ts for full documentation.
 */
import { NextResponse, type NextRequest } from "next/server";

const ALLOW_ORIGINS = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SENSITIVE_PATHS = [
  "/api/hermez/run",
  "/api/hermez/telegram-test",
  "/api/hermez/cron",
];

const HEALTH_PATHS = ["/health", "/api/health"];

const TOKEN_BUCKET = new Map<string, { tokens: number; ts: number }>();
const LIMIT_DEFAULT = 120;
const LIMIT_SENSITIVE = 30;
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

function isHealthPath(pathname: string): boolean {
  return HEALTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function buildCsp(): string {
  // Allow the YKP Hub portal to embed Hermez in an iframe (preview).
  // CORS_ORIGIN is the Hub origin (e.g. https://ykp-hub-production.up.railway.app).
  // If unset, frame-ancestors stays 'none' (standalone, not embeddable).
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

  const limit = isSensitivePath(pathname) ? LIMIT_SENSITIVE : LIMIT_DEFAULT;
  const ip = clientIp(req);
  const { allowed, remaining } = allowRequest(ip, limit);
  if (!allowed) {
    return new NextResponse(
      JSON.stringify({ error: { code: "rate_limited", message: "Too many requests" } }),
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