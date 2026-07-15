import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { formatIdr } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [investors, shareholding] = await Promise.all([
    readTab<Record<string, string>>(TABS.investors),
    readTab<Record<string, string>>(TABS.shareholding)
  ]);

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Portfolio / Cap Table</h1>
        <p className='text-sm text-muted-foreground'>Kepemilikan saham per investor per brand.</p>
      </div>
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Investor</th>
              <th className='px-2 py-1 text-left'>Brand</th>
              <th className='px-2 py-1 text-right'>Share %</th>
              <th className='px-2 py-1 text-right'>Value</th>
              <th className='px-2 py-1 text-left'>Valuation Date</th>
            </tr>
          </thead>
          <tbody>
            {shareholding.map((s) => {
              const inv = investors.find((i) => i.investor_id === s.investor_id);
              return (
                <tr key={s.share_id} className='border-t border-border'>
                  <td className='px-2 py-1'>{inv?.investor_name ?? s.investor_id}</td>
                  <td className='px-2 py-1'>{s.brand_name}</td>
                  <td className='px-2 py-1 text-right'>{s.share_pct}%</td>
                  <td className='px-2 py-1 text-right'>{formatIdr(s.share_value)}</td>
                  <td className='px-2 py-1'>{s.valuation_date}</td>
                </tr>
              );
            })}
            {shareholding.length === 0 && <tr><td colSpan={5} className='px-2 py-3 text-center text-muted-foreground'>Belum ada data kepemilikan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}