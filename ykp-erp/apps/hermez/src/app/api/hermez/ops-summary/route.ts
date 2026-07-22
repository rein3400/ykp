/**
 * Hermez read-only proxy for Operational V1 daily summary.
 * Env: OPS_SUMMARY_URL (e.g. http://localhost:3007/api/ops/summary)
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  const env = process.env as Record<string, string | undefined>;
  const base = env.OPS_SUMMARY_URL ?? env.NEXT_PUBLIC_OPS_URL ?? "http://localhost:3007/api/ops/summary";

  try {
    const target = date ? `${base}?date=${encodeURIComponent(date)}` : base;
    const res = await fetch(target, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { data: null, error: { code: "ops_unavailable", message: `Operational summary returned ${res.status}` } },
        { status: 200 }
      );
    }
    const body = await res.json();
    return NextResponse.json({ data: body.data ?? body, source: "ops_v1", fetched_at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { data: null, error: { code: "ops_unreachable", message: e instanceof Error ? e.message : "Operational unreachable" } },
      { status: 200 }
    );
  }
}
