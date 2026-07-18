import { readTab, TABS, readFinanceTab } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { formatIdr, nowTimestampWib } from '@/lib/format';
import { RegenerateButton } from './regenerate-button';

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

  let finSummary: Record<string, string>[] = [];
  try { finSummary = await readFinanceTab<Record<string, string>>('fin_daily_summary'); } catch { /* optional */ }

  const activeInvestors = investors.filter((i) => i.status === 'active');
  const totalCapitalIn = capital.filter((c) => c.type === 'in' || c.type === 'IN').reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalCapitalOut = capital.filter((c) => c.type === 'out' || c.type === 'OUT').reduce((s, c) => s + Number(c.amount || 0), 0);
  const netCapital = totalCapitalIn - totalCapitalOut;
  const totalDividend = dividend.filter((d) => d.status === 'paid' || d.status === 'PAID').reduce((s, d) => s + Number(d.amount || 0), 0);
  const totalRevenue = finSummary.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const totalProfit = finSummary.reduce((s, r) => s + Number(r.net_profit_estimate || 0), 0);

  const cards = [
    { label: 'Active Investors', value: activeInvestors.length, unit: 'investor' },
    { label: 'Total Capital Injected', value: formatIdr(totalCapitalIn), unit: '' },
    { label: 'Capital Withdrawn', value: formatIdr(totalCapitalOut), unit: '' },
    { label: 'Net Capital', value: formatIdr(netCapital), unit: '' },
    { label: 'Total Revenue (Fin)', value: formatIdr(totalRevenue), unit: '' },
    { label: 'Total Profit (Fin)', value: formatIdr(totalProfit), unit: '' },
    { label: 'Dividend Paid', value: formatIdr(totalDividend), unit: '' },
    { label: 'Brands Tracked', value: shareholding.length, unit: 'holding' }
  ];

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Investor Dashboard</h1>
          <p className='text-sm text-muted-foreground'>Snapshot multi-brand untuk owner & investor.</p>
        </div>
        {session.role === 'owner' && <RegenerateButton />}
      </div>
      <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
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
