/**
 * Cross-app Finance revenue/profit feed for Investor dashboard.
 *
 * Priority:
 *  1. HTTP Finance API (Postgres production) via FINANCE_URL + demo SSO
 *  2. Google Sheets fin_daily_summary when YKP_FINANCE_SPREADSHEET_ID set
 *  3. Empty (zeros) when neither is available
 *
 * Finance ERP is Postgres on Railway; Sheets path is legacy/optional.
 */

import { readFinanceTab } from '@/db/sheets';
import { isMockMode } from '@/db/mock-store';

export interface FinanceTotals {
  totalRevenue: number;
  totalProfit: number;
  rowCount: number;
  source: 'http' | 'sheets' | 'mock' | 'none';
  error?: string;
}

function parseIdrish(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v !== 'string') return 0;
  // strip Rp, dots, commas, spaces
  const n = Number(v.replace(/[Rp\s.]/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function extractCookie(setCookieHeaders: string[]): string {
  // Keep only name=value pairs for Cookie request header
  return setCookieHeaders
    .map((h) => h.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

/**
 * Mint a demo Finance session cookie via POST /api/auth/login (OWNER),
 * then GET /api/fin/summary and aggregate revenue + netProfitEstimate.
 */
async function fetchFinanceViaHttp(): Promise<FinanceTotals | null> {
  // Strip BOM/whitespace — Vercel env stdin can leave a leading ﻿.
  const clean = (v?: string) => (v ?? '').replace(/^﻿/, '').trim().replace(/\/$/, '');
  const base =
    clean(process.env.FINANCE_URL) ||
    clean(process.env.NEXT_PUBLIC_FINANCE_URL) ||
    clean(process.env.FINANCE_SUMMARY_URL?.replace(/\/api\/fin\/summary\/?$/, '')) ||
    '';
  if (!base) return null;

  try {
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ role: 'OWNER', id: 'investor-svc' }),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!loginRes.ok) {
      return {
        totalRevenue: 0,
        totalProfit: 0,
        rowCount: 0,
        source: 'http',
        error: `finance login HTTP ${loginRes.status}`,
      };
    }

    // Node fetch: getSetCookie() when available; fallback to single set-cookie header
    const setCookies: string[] =
      typeof loginRes.headers.getSetCookie === 'function'
        ? loginRes.headers.getSetCookie()
        : [loginRes.headers.get('set-cookie') ?? ''].filter(Boolean);
    const cookie = extractCookie(setCookies);
    if (!cookie) {
      return {
        totalRevenue: 0,
        totalProfit: 0,
        rowCount: 0,
        source: 'http',
        error: 'finance login returned no Set-Cookie',
      };
    }

    // Pull a wide window of daily summary rows (up to 500)
    const sumRes = await fetch(`${base}/api/fin/summary?limit=500`, {
      headers: { accept: 'application/json', cookie },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    if (!sumRes.ok) {
      return {
        totalRevenue: 0,
        totalProfit: 0,
        rowCount: 0,
        source: 'http',
        error: `finance summary HTTP ${sumRes.status}`,
      };
    }

    const json = (await sumRes.json()) as {
      data?: Array<Record<string, unknown>> | { items?: Array<Record<string, unknown>> };
    };
    const raw = json.data;
    const rows: Array<Record<string, unknown>> = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.items)
        ? raw.items
        : [];

    let totalRevenue = 0;
    let totalProfit = 0;
    for (const r of rows) {
      totalRevenue += parseIdrish(r.revenue);
      totalProfit += parseIdrish(
        r.netProfitEstimate ?? r.net_profit_estimate ?? r.estimated_operating_result
      );
    }

    return {
      totalRevenue,
      totalProfit,
      rowCount: rows.length,
      source: 'http',
    };
  } catch (e) {
    return {
      totalRevenue: 0,
      totalProfit: 0,
      rowCount: 0,
      source: 'http',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function fetchFinanceViaSheets(): Promise<FinanceTotals | null> {
  if (!process.env.YKP_FINANCE_SPREADSHEET_ID) return null;
  try {
    const rows = await readFinanceTab<Record<string, string>>('fin_daily_summary');
    let totalRevenue = 0;
    let totalProfit = 0;
    for (const r of rows) {
      totalRevenue += parseIdrish(r.revenue);
      totalProfit += parseIdrish(
        r.net_profit_estimate || r.netProfitEstimate || r.estimated_operating_result
      );
    }
    return {
      totalRevenue,
      totalProfit,
      rowCount: rows.length,
      source: 'sheets',
    };
  } catch (e) {
    return {
      totalRevenue: 0,
      totalProfit: 0,
      rowCount: 0,
      source: 'sheets',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Aggregate Finance revenue + profit for Investor dashboard cards.
 * Prefer live Finance HTTP; fall back to Sheets; mock returns zeros with source=mock.
 */
export async function getFinanceTotals(): Promise<FinanceTotals> {
  if (isMockMode()) {
    // Mock has no Finance DB; surface zeros with explicit source so UI can label.
    return { totalRevenue: 0, totalProfit: 0, rowCount: 0, source: 'mock' };
  }

  // Prefer HTTP (production Finance is Postgres)
  const http = await fetchFinanceViaHttp();
  if (http && (http.rowCount > 0 || !http.error)) return http;

  // Sheets fallback
  const sheets = await fetchFinanceViaSheets();
  if (sheets && (sheets.rowCount > 0 || !sheets.error)) return sheets;

  // Prefer the more informative error
  if (http?.error) return http;
  if (sheets?.error) return sheets;
  return { totalRevenue: 0, totalProfit: 0, rowCount: 0, source: 'none' };
}
