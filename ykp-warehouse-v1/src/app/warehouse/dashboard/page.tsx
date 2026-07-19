import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import DashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

/**
 * Fetch POS net sales (finance module) for the given dates via the finance
 * app's PUBLIC summary endpoint — the no-write-back cross-module pattern.
 * Best-effort: finance unreachable/unconfigured yields 0 (KPI shows N/A).
 */
async function fetchPosNetSales(dates: string[]): Promise<number> {
  const base = process.env.YKP_FINANCE_URL ?? 'http://localhost:3003';
  const sums = await Promise.all(
    dates.map(async (d) => {
      try {
        const res = await fetch(`${base}/api/finance/summary?date=${encodeURIComponent(d)}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) return 0;
        const j = (await res.json()) as { data?: { items?: { net_sales?: string }[] } };
        return (j.data?.items ?? []).reduce((s, r) => s + Number(r.net_sales || 0), 0);
      } catch {
        return 0;
      }
    })
  );
  return sums.reduce((a, b) => a + b, 0);
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [closing, waste, items, receiving, stockIssue, ledger] = await Promise.all([
    readTab<Record<string, string>>(TABS.legacyClosing),
    readTab<Record<string, string>>(TABS.waste),
    readTab<Record<string, string>>(TABS.items),
    // Prefer new receiving header; fall back to legacy flat
    readTab<Record<string, string>>(TABS.receiving).then(async (r) =>
      r.length > 0 ? r : readTab<Record<string, string>>(TABS.legacyPenerimaan)
    ),
    readTab<Record<string, string>>(TABS.stockIssue).then(async (r) =>
      r.length > 0 ? r : readTab<Record<string, string>>(TABS.legacyPemakaian)
    ),
    readTab<Record<string, string>>(TABS.stockMovement)
  ]);

  // KPI week = 7 most recent closing dates (same window the client uses).
  const weekDates = Array.from(new Set(closing.map((c) => c.date))).sort().reverse().slice(0, 7);
  const posNetSales = await fetchPosNetSales(weekDates);

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Dashboard Kontrol Bahan Baku</h1>
        <p className='text-sm text-muted-foreground'>KPI mingguan per Excel Dashboard. Diisi tiap Senin pagi oleh Manager Outlet.</p>
      </div>
      <DashboardClient
        closing={closing}
        waste={waste}
        items={items}
        receiving={receiving}
        stockIssue={stockIssue}
        ledger={ledger}
        posNetSales={posNetSales}
      />
    </div>
  );
}
