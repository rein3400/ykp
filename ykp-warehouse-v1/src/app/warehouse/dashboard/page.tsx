import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import DashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

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
      />
    </div>
  );
}
