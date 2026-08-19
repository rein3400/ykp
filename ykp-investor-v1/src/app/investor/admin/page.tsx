import { readTab, readTabSafe, readFinanceTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import AdminClient from './admin-client';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'owner') redirect('/investor');

  const [investors, shareholding, documents, users, dividends] = await Promise.all([
    readTabSafe<Record<string, string>>(TABS.investors),
    readTabSafe<Record<string, string>>(TABS.shareholding),
    readTabSafe<Record<string, string>>(TABS.documents),
    readTabSafe<Record<string, string>>(TABS.users),
    readTabSafe<Record<string, string>>(TABS.dividend)
  ]);
  let brands: Record<string, string>[] = [];
  try {
    brands = await readFinanceTab<Record<string, string>>('master_brand');
  } catch {
    /* finance spreadsheet not configured — brand select falls back to shareholding brands */
  }
  if (brands.length === 0) {
    const seen = new Map<string, string>();
    for (const sh of shareholding) {
      if (sh.brand_id && !seen.has(sh.brand_id)) seen.set(sh.brand_id, sh.brand_name || sh.brand_id);
    }
    brands = [...seen.entries()].map(([brand_id, brand_name]) => ({ brand_id, brand_name }));
  }

  const rows = investors.map((inv) => ({
    investor_id: inv.investor_id,
    investor_name: inv.investor_name,
    investor_type: inv.investor_type,
    status: inv.status,
    join_date: inv.join_date,
    shareholding: shareholding.filter((sh) => sh.investor_id === inv.investor_id),
    documents: documents.filter((d) => d.investor_id === inv.investor_id),
    login_username: users.find((u) => u.investor_id === inv.investor_id)?.username ?? ''
  }));
  const sortedDividends = [...dividends].sort((a, b) =>
    (b.period ?? '').localeCompare(a.period ?? '') || (b.created_at ?? '').localeCompare(a.created_at ?? '')
  );

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Admin Investor</h1>
        <p className='text-sm text-muted-foreground'>
          Tambah akun investor dengan MOU, atur persen bagi hasil per brand, dan buat proposal dividen otomatis.
        </p>
      </div>
      <AdminClient
        investors={rows}
        brands={brands}
        dividends={sortedDividends.slice(0, 50)}
        today={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
