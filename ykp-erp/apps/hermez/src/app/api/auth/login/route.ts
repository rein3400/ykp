/**
 * Login API — demo only.
 * Real users: Clerk (planned). For pilot demo: simple form
 * that mints a session cookie with role=OWNER.
 */
import { setSession } from "@ykp/auth";

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
