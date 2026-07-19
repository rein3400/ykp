import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { todayWib } from '@/lib/format';
import ReceiptsClient from './receipts-client';

export const dynamic = 'force-dynamic';

export default async function ReceiptsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [receipts, outlets] = await Promise.all([
    readTab<Record<string, string>>(TABS.receipts),
    readTab<Record<string, string>>(TABS.outlets)
  ]);
  const sorted = [...receipts].sort((a, b) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? '')
  );
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Struk & Bukti Pembelian</h1>
        <p className='text-sm text-muted-foreground'>
          Upload foto struk dari kamera HP sebagai bukti pembelian. Foto wajib ΓÇö otomatis
          diberi watermark tanggal & lokasi.
        </p>
      </div>
      <ReceiptsClient
        receipts={sorted}
        outlets={outlets.filter((o) => o.status === 'active')}
        today={todayWib()}
      />
    </div>
  );
}
