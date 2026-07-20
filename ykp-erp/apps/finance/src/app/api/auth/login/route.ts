/**
 * Login API — demo only, gated by ERP_SSO_SECRET.
 * Real users: Clerk (planned). For pilot demo: simple form
 * that mints a session cookie with role=OWNER after verifying the secret.
 *
 * GET handler: Hub portal SSO bridge. Hub opens
 *   /api/auth/login?role=<hubRole>&redirect=/<path>&token=<ERP_SSO_SECRET>
 * We mint the ykp_session cookie (same as POST) and 302-redirect
 * to `redirect` (default "/"). The token must equal the ERP_SSO_SECRET
 * env var to prevent unauthenticated role minting.
 * `redirect` is constrained to same-origin absolute paths to avoid
 * open-redirect abuse.
 */
import { setSession, isRole, Role } from "@ykp/auth";

const SSO_SECRET = process.env.ERP_SSO_SECRET?.trim() ?? "";

function verifySecret(token: string | null): boolean {
  if (!SSO_SECRET || SSO_SECRET.length < 16) return false;
  if (!token) return false;
  // Constant-time comparison to avoid timing leaks.
  const a = Buffer.from(token);
  const b = Buffer.from(SSO_SECRET);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function safeRedirect(target: string | null): string {
  // Only allow same-origin absolute paths (start with "/"), not "//host".
  if (!target || !target.startsWith("/") || target.startsWith("//")) return "/";
  return target;
}

function publicOrigin(req: Request): string {
  const xfHost = req.headers.get("x-forwarded-host");
  const xfProto = req.headers.get("x-forwarded-proto");
  if (xfHost) return `${xfProto ?? "https"}://${xfHost}`;
  return new URL(req.url).origin;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!verifySecret(token)) {
    return Response.json({ error: { code: "unauthorized", message: "Invalid or missing SSO token" } }, { status: 401 });
  }
  const roleParam = url.searchParams.get("role") ?? "OWNER";
  const role = isRole(roleParam) ? (roleParam as Role) : Role.OWNER;
  const redirect = safeRedirect(url.searchParams.get("redirect"));
  await setSession({
    id: "demo-user",
    email: "demo@ykp.local",
    name: "Demo Owner",
    role,
  });
  return Response.redirect(new URL(redirect, publicOrigin(req)), 302);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password ?? "");
  if (!verifySecret(password)) {
    return Response.json({ error: { code: "unauthorized", message: "Invalid or missing access password" } }, { status: 401 });
  }
  const role = body.role ?? "OWNER";
  const id = body.id ?? "demo-user";
  await setSession({
    id,
    email: "demo@ykp.local",
    name: "Demo Owner",
    role: role as never,
  });
  return Response.json({ ok: true, role });
}
