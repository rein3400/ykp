/**
 * Login API — demo only.
 * Real users: Clerk (planned). For pilot demo: simple form
 * that mints a session cookie with role=OWNER.
 *
 * GET handler: Hub portal SSO bridge. Hub opens
 *   /api/auth/login?role=<hubRole>&redirect=/<path>
 * We mint the ykp_session cookie (same as POST) and 302-redirect
 * to `redirect` (default "/"). No shared secret — the existing
 * POST login already accepts any role with no credential check
 * (demo role-picker), so this GET adds no new attack surface.
 * `redirect` is constrained to same-origin absolute paths to avoid
 * open-redirect abuse.
 */
import { setSession, isRole, Role } from "@ykp/auth";

function safeRedirect(target: string | null): string {
  // Only allow same-origin absolute paths (start with "/"), not "//host".
  if (!target || !target.startsWith("/") || target.startsWith("//")) return "/";
  return target;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const roleParam = url.searchParams.get("role") ?? "OWNER";
  const role = isRole(roleParam) ? (roleParam as Role) : Role.OWNER;
  const redirect = safeRedirect(url.searchParams.get("redirect"));
  await setSession({
    id: "demo-user",
    email: "demo@ykp.local",
    name: "Demo Owner",
    role,
  });
  return Response.redirect(new URL(redirect, url.origin), 302);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
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
