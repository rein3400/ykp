import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import WasteClient from './waste-client';

export const dynamic = 'force-dynamic';

export default async function WastePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [rows, items, outlets, locations] = await Promise.all([
    readTab<Record<string, string>>(TABS.waste),
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.locations)
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>F4 — Waste / Kerusakan</h1>
        <p className='text-sm text-destructive'>WAJIB FOTO. Tanpa foto = tidak diakui sebagai waste (jadi tanggung jawab PIC).</p>
      </div>
      <WasteClient rows={rows} items={items} outlets={outlets} locations={locations} />
    </div>
  );
}