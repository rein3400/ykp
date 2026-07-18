/**
 * Hermez read-only proxy for warehouse alerts (HIGH/CRITICAL).
 * Env: WAREHOUSE_ALERTS_URL (default http://localhost:3005/api/warehouse/alerts)
 *
 * Dynamic `process.env[key]` access so Next.js does not inline the build-time
 * (unset) value into the bundle — see warehouse-summary/route.ts for details.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const severity = url.searchParams.get("severity") ?? "";
  const status = url.searchParams.get("status") ?? "OPEN";
  const env = process.env as Record<string, string | undefined>;
  const base =
    env.WAREHOUSE_ALERTS_URL ??
    "http://localhost:3005/api/warehouse/alerts";

  try {
    const params = new URLSearchParams();
    if (severity) params.set("severity", severity);
    if (status) params.set("status", status);
    const target = `${base}?${params.toString()}`;
    const res = await fetch(target, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { data: { items: [], total_items: 0 }, error: { code: "warehouse_unavailable", message: String(res.status) } },
        { status: 200 },
      );
    }
    const body = await res.json();
    return NextResponse.json({
      data: body.data ?? body,
      source: "warehouse_v1",
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        data: { items: [], total_items: 0 },
        error: {
          code: "warehouse_unreachable",
          message: e instanceof Error ? e.message : "Warehouse unreachable",
        },
      },
      { status: 200 },
    );
  }
}
