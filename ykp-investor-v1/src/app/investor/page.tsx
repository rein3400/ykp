import { readTab, TABS, readFinanceTab } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { formatIdr, nowTimestampWib } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function InvestorDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [investors, capital, dividend, shareholding] = await Promise.all([
    readTab<Record<string, string>>(TABS.investors),
    readTab<Record<string, string>>(TABS.capital),
    readTab<Record<string, string>>(TABS.dividend),
    readTab<Record<string, string>>(TABS.shareholding)
  ]);

  // Try cross-read finance summary
  let finSummary: Record<string, string>[] = [];
  try { finSummary = await readFinanceTab<Record<string, string>>('fin_daily_summary'); } catch { /* finance sheet not configured */ }

  const activeInvestors = investors.filter((i) => i.status === 'active');
  const totalCapital = capital.reduce((s, c) => s + (c.type === 'in' ? Number(c.amount || 0) : -Number(c.amount || 0)), 0);
  const totalDividend = dividend.filter((d) => d.status === 'paid').reduce((s, d) => s + Number(d.amount || 0), 0);
  const totalRevenue = finSummary.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const totalProfit = finSummary.reduce((s, r) => s + Number(r.net_profit_estimate || 0), 0);

  const cards = [
    { label: 'Active Investors', value: activeInvestors.length, unit: 'investor' },
    { label: 'Total Capital', value: formatIdr(totalCapital), unit: '' },
    { label: 'Total Revenue (Fin)', value: formatIdr(totalRevenue), unit: '' },
    { label: 'Total Profit (Fin)', value: formatIdr(totalProfit), unit: '' },
    { label: 'Dividend Paid', value: formatIdr(totalDividend), unit: '' },
    { label: 'Brands Tracked', value: shareholding.length, unit: 'holding' }
  ];

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Investor Dashboard</h1>
        <p className='text-sm text-muted-foreground'>Snapshot multi-brand untuk owner & investor.</p>
      </div>
      <div className='grid grid-cols-2 gap-3 md:grid-cols-3'>
        {cards.map((c) => (
          <div key={c.label} className='rounded border border-border bg-background p-3'>
            <p className='text-[10px] text-muted-foreground uppercase'>{c.label}</p>
            <p className='text-lg font-bold'>{c.value}{c.unit ? ` ${c.unit}` : ''}</p>
          </div>
        ))}
      </div>
      <div className='text-xs text-muted-foreground'>Generated {nowTimestampWib()}</div>
    </div>
  );
}