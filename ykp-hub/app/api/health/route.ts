import { NextResponse } from 'next/server';
import { HUB_MODULES, moduleBaseUrl, moduleServerProbeUrl } from '../../config';

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
    const response = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    let recordCount: number | null = null;
    if (expectCount && response.ok) {
      const body = await response.text();
      try {
        const json = JSON.parse(body);
        const count = json?.data?.count ?? json?.data?.total ?? null;
        recordCount = typeof count === 'number' ? count : null;
      } catch {
        return { status: response.status, ms: Date.now() - start, recordCount: null, error: 'Invalid health response' };
      }
    }
    return { status: response.status, ms: Date.now() - start, recordCount };
  } catch (error) {
    return { status: null, ms: Date.now() - start, recordCount: null, error: error instanceof Error ? error.message : 'unknown' };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const results = await Promise.all(HUB_MODULES.map(async (module) => {
    const ping = await probe(moduleServerProbeUrl(module), module.probeReturnsCount);
    return {
      id: module.id,
      name: module.name,
      url: moduleBaseUrl(module),
      pingMs: ping.ms,
      httpStatus: ping.status,
      reachable: ping.status !== null && ping.status >= 200 && ping.status < 300 && !ping.error,
      recordCount: ping.recordCount
    };
  }));
  const upCount = results.filter((result) => result.reachable).length;
  const overall = upCount === results.length ? 'ok' : upCount > 0 ? 'degraded' : 'down';
  return NextResponse.json({ data: { overall, results, ts: new Date().toISOString() } });
}
