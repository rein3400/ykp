import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { formatIdr } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ReturnsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [investors, capital, dividend, shareholding] = await Promise.all([
    readTab<Record<string, string>>(TABS.investors),
    readTab<Record<string, string>>(TABS.capital),
    readTab<Record<string, string>>(TABS.dividend),
    readTab<Record<string, string>>(TABS.shareholding)
  ]);

  // investor role: only own ROI row (never other investors' positions)
  const visibleInvestors = session.role === 'investor' && session.investorId
    ? investors.filter((i) => i.investor_id === session.investorId)
    : investors;

  const roi: { investor_id: string; name: string; total_in: number; total_out: number; net: number; dividend: number; roi_pct: string }[] = [];
  for (const inv of visibleInvestors) {
    const cap = capital.filter((c) => c.investor_id === inv.investor_id);
    const div = dividend.filter(
      (d) => d.investor_id === inv.investor_id && (d.status || '').toLowerCase() === 'paid'
    );
    const totalIn = cap
      .filter((c) => (c.type || '').toLowerCase() === 'in')
      .reduce((s, c) => s + Number(c.amount || 0), 0);
    const totalOut = cap
      .filter((c) => (c.type || '').toLowerCase() === 'out')
      .reduce((s, c) => s + Number(c.amount || 0), 0);
    const net = totalIn - totalOut;
    const divTotal = div.reduce((s, d) => s + Number(d.amount || 0), 0);
    const roiPct = totalIn > 0 ? ((divTotal / totalIn) * 100).toFixed(1) : '0';
    roi.push({ investor_id: inv.investor_id, name: inv.investor_name, total_in: totalIn, total_out: totalOut, net, dividend: divTotal, roi_pct: roiPct });
  }

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Returns / ROI</h1>
        <p className='text-sm text-muted-foreground'>Return on investment per investor (dividen vs capital masuk).</p>
      </div>
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Investor</th>
              <th className='px-2 py-1 text-right'>Capital In</th>
              <th className='px-2 py-1 text-right'>Capital Out</th>
              <th className='px-2 py-1 text-right'>Net Capital</th>
              <th className='px-2 py-1 text-right'>Dividend Paid</th>
              <th className='px-2 py-1 text-right'>ROI %</th>
            </tr>
          </thead>
          <tbody>
            {roi.map((r) => (
              <tr key={r.investor_id} className='border-t border-border'>
                <td className='px-2 py-1'>{r.name}</td>
                <td className='px-2 py-1 text-right'>{formatIdr(r.total_in)}</td>
                <td className='px-2 py-1 text-right'>{formatIdr(r.total_out)}</td>
                <td className='px-2 py-1 text-right font-medium'>{formatIdr(r.net)}</td>
                <td className='px-2 py-1 text-right text-success'>{formatIdr(r.dividend)}</td>
                <td className='px-2 py-1 text-right font-bold'>{r.roi_pct}%</td>
              </tr>
            ))}
            {roi.length === 0 && <tr><td colSpan={6} className='px-2 py-3 text-center text-muted-foreground'>Belum ada data investor.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}