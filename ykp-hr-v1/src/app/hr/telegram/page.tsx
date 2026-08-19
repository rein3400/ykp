/**
 * Hubungkan Telegram — halaman untuk staf non-teknis.
 * Staf login → tap "Dapatkan Kode" → tap "Buka Telegram" → selesai.
 * Tidak perlu mengetik perintah apa pun.
 */
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { TelegramLinkClient } from '@/features/hr/components/telegram-link-client';

export const dynamic = 'force-dynamic';

export default async function TelegramLinkPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Hubungkan Telegram</h1>
        <p className='text-sm text-muted-foreground'>
          Hubungkan akun Telegram kamu agar bisa absen, lihat jadwal, dan ajukan cuti langsung dari Telegram.
        </p>
      </div>
      <TelegramLinkClient />
    </div>
  );
}
