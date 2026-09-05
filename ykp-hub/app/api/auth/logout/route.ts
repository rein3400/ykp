import { NextResponse } from "next/server";

const COOKIE_NAME = "ykp_hub_session";

/** Clear the hub session cookie. */
export async function POST() {
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
