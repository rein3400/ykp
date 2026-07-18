import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { formatIdr, nowTimestampWib } from '@/lib/format';
import { getFinanceTotals } from '@/lib/finance-summary';
import { RegenerateButton } from './regenerate-button';

export const dynamic = 'force-dynamic';

export default async function InvestorDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [investors, capital, dividend, shareholding, fin] = await Promise.all([
    readTab<Record<string, string>>(TABS.investors),
    readTab<Record<string, string>>(TABS.capital),
    readTab<Record<string, string>>(TABS.dividend),
    readTab<Record<string, string>>(TABS.shareholding),
    getFinanceTotals(),
  ]);

  const activeInvestors = investors.filter((i) => (i.status || '').toLowerCase() === 'active');
  const totalCapitalIn = capital
    .filter((c) => (c.type || '').toLowerCase() === 'in')
    .reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalCapitalOut = capital
    .filter((c) => (c.type || '').toLowerCase() === 'out')
    .reduce((s, c) => s + Number(c.amount || 0), 0);
  const netCapital = totalCapitalIn - totalCapitalOut;
  const totalDividend = dividend
    .filter((d) => {
      const st = (d.status || '').toLowerCase();
      return st === 'paid' || st === 'declared';
    })
    .reduce((s, d) => s + Number(d.amount || 0), 0);

  const cards = [
    { label: 'Active Investors', value: activeInvestors.length, unit: 'investor' },
    { label: 'Total Capital Injected', value: formatIdr(totalCapitalIn), unit: '' },
    { label: 'Capital Withdrawn', value: formatIdr(totalCapitalOut), unit: '' },
    { label: 'Net Capital', value: formatIdr(netCapital), unit: '' },
    { label: 'Total Revenue (Fin)', value: formatIdr(fin.totalRevenue), unit: '' },
    { label: 'Total Profit (Fin)', value: formatIdr(fin.totalProfit), unit: '' },
    { label: 'Dividend Paid', value: formatIdr(totalDividend), unit: '' },
    { label: 'Brands Tracked', value: shareholding.length, unit: 'holding' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investor Dashboard</h1>
          <p className="text-sm text-muted-foreground">Snapshot multi-brand untuk owner & investor.</p>
        </div>
        {session.role === 'owner' && <RegenerateButton />}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded border border-border bg-background p-3">
            <p className="text-[10px] text-muted-foreground uppercase">{c.label}</p>
            <p className="text-lg font-bold">
              {c.value}
              {c.unit ? ` ${c.unit}` : ''}
            </p>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        Generated {nowTimestampWib()}
        {' · '}
        Finance source: {fin.source}
        {fin.rowCount > 0 ? ` (${fin.rowCount} rows)` : ''}
        {fin.error ? ` · warn: ${fin.error}` : ''}
      </div>
    </div>
  );
}
