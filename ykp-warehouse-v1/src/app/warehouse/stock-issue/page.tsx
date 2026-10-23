import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, scopeFilter, type Role } from '@/lib/rbac';
export const dynamic = 'force-dynamic';

export default async function StockIssuePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role as Role, 'view', 'stock_issue')) redirect('/warehouse');
  const scope = scopeFilter(session.role as Role, session.brandId, session.outletId);
  if (['outlet_manager', 'supervisor', 'kitchen_lead', 'staff'].includes(session.role) && !scope.outletId) redirect('/warehouse');
  if (session.role === 'brand_manager' && !scope.brandId) redirect('/warehouse');
  const [headers, details, items, locations] = await Promise.all([
    readTab(TABS.stockIssue), readTab(TABS.stockIssueItem), readTab(TABS.items), readTab(TABS.locations)
  ]);
  const visible = headers.filter((row) => (!scope.brandId || row.brand_id === scope.brandId) && (!scope.outletId || row.outlet_id === scope.outletId));
  const itemNames = new Map(items.map((row) => [row.item_id, row.item_name]));
  const locationNames = new Map(locations.map((row) => [row.location_id, row.location_name]));
  return <div className='space-y-5'>
    <header><h1 className='text-2xl font-bold'>Stock Issue</h1><p className='mt-2 text-sm text-muted-foreground'>Pengeluaran stok terstruktur: dokumen dan rincian item.</p></header>
    <div className='rounded-xl border p-4 text-sm'>Pembuatan dokumen baru sedang dalam perbaikan validasi ledger. Riwayat tetap dapat dibaca; tidak ada stok yang diubah dari halaman ini.</div>
    <Link className='inline-block text-sm underline' href='/warehouse/pemakaian'>Lihat arsip Bon Pemakaian</Link>
    {visible.length === 0 && <p className='rounded-xl border p-6 text-sm text-muted-foreground'>Belum ada dokumen Stock Issue untuk cakupan akun ini.</p>}
    {visible.slice().reverse().map((header) => <details key={header.issue_id} className='rounded-xl border p-4'>
      <summary className='cursor-pointer text-sm font-semibold'>{header.issue_number || header.issue_id} · {header.date || 'Tanggal —'} · {header.approval_status || 'Status —'}</summary>
      <p className='my-3 text-xs text-muted-foreground'>Asal: {locationNames.get(header.source_location_id) || header.source_location_id} · Tujuan: {locationNames.get(header.destination_location_id) || header.destination_location_id || 'Pemakaian'}</p>
      <ul className='space-y-2'>{details.filter((row) => row.issue_id === header.issue_id).map((row) => <li className='rounded border p-3 text-sm' key={row.issue_item_id}>
        {itemNames.get(row.item_id) || row.item_id} · {row.issued_qty} {row.unit}{row.purpose ? ` · ${row.purpose}` : ''}
      </li>)}</ul>
    </details>)}
  </div>;
}
