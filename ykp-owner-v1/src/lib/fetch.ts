/** Server-side fetch with hard timeout — modules get ≤4s before isolation. */

export interface FetchJsonResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  latencyMs: number;
  error: string | null;
}

export async function fetchJson<T = unknown>(url: string, timeoutMs = 4000): Promise<FetchJsonResult<T>> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const botSecret = process.env.TELEGRAM_BOT_SECRET;
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(botSecret ? { 'x-bot-secret': botSecret } : {})
      }
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return { ok: false, status: res.status, data: null, latencyMs, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data, latencyMs, error: null };
  } catch (e) {
    const latencyMs = Date.now() - started;
    const msg = e instanceof Error && e.name === 'AbortError' ? `timeout ${timeoutMs}ms` : 'unreachable';
    return { ok: false, status: 0, data: null, latencyMs, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** Modules return either {data:{items:[]}} or {data:{items:[],total_items}}. */
export function extractItems(data: unknown): Record<string, string>[] {
  if (!data || typeof data !== 'object') return [];
  const d = (data as { data?: unknown }).data;
  if (!d || typeof d !== 'object') return [];
  const items = (d as { items?: unknown }).items;
  return Array.isArray(items) ? (items as Record<string, string>[]) : [];
}

export function extractCount(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const d = (data as { data?: unknown }).data;
  if (!d || typeof d !== 'object') return null;
  // finance/ops shape: {count, latest_date}; hr shape: {tabs:[...], total}
  const c = (d as { count?: unknown }).count;
  if (typeof c === 'number') return c;
  const t = (d as { total?: unknown }).total;
  if (typeof t === 'number') return t;
  return null;
}
