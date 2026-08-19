/**
 * Hubungkan Telegram — halaman untuk staf non-teknis.
 */
import { TelegramLinkClient } from '@/components/telegram-link-client';

export default function InvestorTelegramPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Hubungkan Telegram</h1>
        <p className='text-sm text-muted-foreground'>
          Hubungkan akun Telegram kamu agar bisa menerima notifikasi dan bertanya ke Hermez.
        </p>
      </div>
      <TelegramLinkClient linkPath='/api/investor/telegram/link' />
    </div>
  );
}
