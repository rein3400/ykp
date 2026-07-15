import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import PemakaianClient from './pemakaian-client';

export const dynamic = 'force-dynamic';

export default async function PemakaianPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [rows, items, outlets] = await Promise.all([
    readTab<Record<string, string>>(TABS.legacyPemakaian),
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.outlets)
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>F3 — Bon Pemakaian Dapur</h1>
        <p className='text-sm text-muted-foreground'>Tiap kali bahan keluar dari gudang outlet wajib dicatat. Tidak ada bon = bahan tidak boleh keluar.</p>
      </div>
      <PemakaianClient rows={rows} items={items} outlets={outlets} />
    </div>
  );
}