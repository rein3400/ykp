/**
 * Hermez read-only proxy for warehouse daily summary.
 * Fetches public GET /api/warehouse/summary from ykp-warehouse-v1.
 *
 * Env: WAREHOUSE_SUMMARY_URL (e.g. http://localhost:3005/api/warehouse/summary)
 * Falls back to empty data if warehouse is unreachable — Hermez must not 5xx.
 *
 * NOTE: env is read via dynamic `process.env[key]` so Next.js does not inline
 * the build-time value (which is unset in the Docker build stage). Without this,
 * the literal localhost fallback would be baked into the bundle and the
 * runtime Railway env would never take effect.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  const env = process.env as Record<string, string | undefined>;
  const base =
    env.WAREHOUSE_SUMMARY_URL ??
    env.NEXT_PUBLIC_WAREHOUSE_URL ??
    "http://localhost:3005/api/warehouse/summary";

  try {
    const target = date ? `${base}?date=${encodeURIComponent(date)}` : base;
    const res = await fetch(target, {
      headers: { Accept: "application/json" },
      // short timeout via AbortSignal
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: "warehouse_unavailable",
            message: `Warehouse summary returned ${res.status}`,
          },
        },
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
        data: null,
        error: {
          code: "warehouse_unreachable",
          message: e instanceof Error ? e.message : "Warehouse unreachable",
        },
      },
      { status: 200 },
    );
  }
}
