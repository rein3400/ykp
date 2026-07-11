/**
 * Finance app middleware — CSP / CORS / rate-limit (Defect 14 fix).
 * See apps/hr/src/middleware.ts for full documentation.
 */
import { NextResponse, type NextRequest } from "next/server";

const ALLOW_ORIGINS = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SENSITIVE_PATHS = [
  "/api/fin/pos/import",
  "/api/fin/telegram-test",
  "/api/fin/petty-cash",
  "/api/fin/expense",
  "/api/fin/supplier",
];

const TOKEN_BUCKET = new Map<string, { tokens: number; ts: number }>();
const LIMIT_DEFAULT = 120;
const LIMIT_SENSITIVE = 60;
const WINDOW_MS = 60_000;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.ip ||
    "unknown"
  );
}

function allowRequest(ip: string, limit: number): boolean {
  const now = Date.now();
  const entry = TOKEN_BUCKET.get(ip);
  if (!entry) {
    TOKEN_BUCKET.set(ip, { tokens: limit - 1, ts: now });
    return true;
  }
  const elapsed = now - entry.ts;
  if (elapsed > WINDOW_MS) {
    TOKEN_BUCKET.set(ip, { tokens: limit - 1, ts: now });
    return true;
  }
  if (entry.tokens <= 0) return false;
  entry.tokens -= 1;
  return true;
}

function isSensitivePath(pathname: string): boolean {
  return SENSITIVE_PATHS.some((p) => pathname.startsWith(p));
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

  const limit = isSensitivePath(req.nextUrl.pathname) ? LIMIT_SENSITIVE : LIMIT_DEFAULT;
  const ip = clientIp(req);
  if (!allowRequest(ip, limit)) {
    return new NextResponse(
      JSON.stringify({ error: { code: "rate_limited", message: "Too many requests" } }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  const res = NextResponse.next();
  res.headers.set("Content-Security-Policy", buildCsp());
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return applyCors(req, res);
}

export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};