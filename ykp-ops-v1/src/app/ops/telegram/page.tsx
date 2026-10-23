/**
 * Hubungkan Telegram — halaman untuk staf non-teknis.
 */
import { TelegramLinkClient } from '@/components/telegram-link-client';

export const dynamic = 'force-dynamic';

export default function OpsTelegramPage() {
  const botUsername = process.env.TELEGRAM_OPS_BOT_USERNAME || 'ykp_operasional_bot';
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Hubungkan Telegram</h1>
        <p className='text-sm text-muted-foreground'>
          Hubungkan akun Telegram ke bot Operasional untuk menerima notifikasi dan melaporkan kegiatan outlet.
        </p>
      </div>
      <TelegramLinkClient linkPath='/api/ops/telegram/link' botUsername={botUsername} />
    </div>
  );
}
