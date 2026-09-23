/**
 * Hub health probe — checks each local YKP app via its public probe path
 * (summary count endpoint where one exists, /login for the owner dashboard)
 * and extracts record counts where possible. App registry + URLs live in
 * app/config (env-overridable, local by default).
 */
import { NextResponse } from "next/server";
import { HUB_MODULES, moduleBaseUrl, moduleProbeUrl } from "../../config";

const TIMEOUT_MS = 3000;

interface ProbeResult {
  status: number | null;
  ms: number;
  recordCount: number | null;
  error?: string;
}

async function probe(url: string, expectCount: boolean): Promise<ProbeResult> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    let recordCount: number | null = null;
    if (expectCount && r.ok) {
      try {
        const j = await r.json();
        // finance/warehouse/ops/investor shape: {data:{count}}; hr shape: {data:{total}}
        const c = j?.data?.count ?? j?.data?.total ?? null;
        recordCount = typeof c === "number" ? c : null;
      } catch {
        // body not JSON — leave null
      }
    }
    return { status: r.status, ms: Date.now() - start, recordCount };
  } catch (e) {
    return { status: null, ms: Date.now() - start, recordCount: null, error: e instanceof Error ? e.message : "unknown" };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const results = await Promise.all(
    HUB_MODULES.map(async (m) => {
      const base = moduleBaseUrl(m);
      const ping = await probe(moduleProbeUrl(m), m.probeReturnsCount);
      return {
        id: m.id,
        name: m.name,
        url: base,
        pingMs: ping.ms,
        httpStatus: ping.status,
        reachable: ping.status != null && ping.status < 500,
        recordCount: ping.recordCount
      };
    })
  );

  const upCount = results.filter((r) => r.reachable).length;
  const overall = upCount === results.length ? "ok" : upCount > 0 ? "degraded" : "down";
  return NextResponse.json({ data: { overall, results, ts: new Date().toISOString() } });
}
