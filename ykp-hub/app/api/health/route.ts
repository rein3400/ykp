/**
 * Hub health probe — checks each upstream app + counts records where possible.
 * Used by hub landing page to show real system status (not hardcoded numbers).
 */
import { NextResponse } from "next/server";

const APPS = [
  { id: "finance", name: "Finance", url: "https://ykp-erp-finance-production.up.railway.app", countUrl: null as string | null },
  { id: "hr", name: "HR Production", url: "https://ykp-erp-hr-production.up.railway.app", countUrl: null as string | null },
  { id: "hermez", name: "Hermez AI", url: "https://ykp-erp-hermez-production.up.railway.app", countUrl: null as string | null },
  { id: "hr-v1", name: "HR Pilot", url: "https://ykp-hr-v1-standalone-production.up.railway.app", countUrl: "https://ykp-hr-v1-standalone-production.up.railway.app/api/hr/summary/count" },
  { id: "warehouse", name: "Warehouse", url: process.env.NEXT_PUBLIC_WAREHOUSE_URL ?? "https://ykp-warehouse-v1.vercel.app", countUrl: null as string | null },
  { id: "investor", name: "Investor", url: process.env.NEXT_PUBLIC_INVESTOR_URL ?? "https://ykp-investor-v1.vercel.app", countUrl: null as string | null },
  { id: "ops", name: "Operational", url: process.env.NEXT_PUBLIC_OPS_URL ?? "https://ykp-ops-v1.vercel.app", countUrl: null as string | null },
];

async function probe(url: string, timeoutMs = 8000): Promise<{ status: number | null; ms: number; error?: string }> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    return { status: r.status, ms: Date.now() - start };
  } catch (e) {
    return { status: null, ms: Date.now() - start, error: e instanceof Error ? e.message : "unknown" };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const results = await Promise.all(
    APPS.map(async (app) => {
      const ping = await probe(app.url);
      let recordCount: number | null = null;
      if (app.countUrl) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        try {
          const r = await fetch(app.countUrl, { cache: "no-store", signal: ctrl.signal });
          if (r.ok) {
            const j = await r.json();
            const total = j?.data?.total ?? null;
            recordCount = typeof total === "number" ? total : null;
          }
        } catch {
          // leave null
        } finally {
          clearTimeout(timer);
        }
      }
      return {
        id: app.id,
        name: app.name,
        url: app.url,
        pingMs: ping.ms,
        httpStatus: ping.status,
        reachable: ping.status != null && ping.status < 500,
        recordCount
      };
    })
  );

  const upCount = results.filter((r) => r.reachable).length;
  const overall = upCount === results.length ? "ok" : upCount > 0 ? "degraded" : "down";
  return NextResponse.json({ data: { overall, results, ts: new Date().toISOString() } });
}