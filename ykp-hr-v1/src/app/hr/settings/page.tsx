import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import SmtpClient from './smtp-client';

export const dynamic = 'force-dynamic';

export default async function SmtpSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['owner', 'super_admin', 'hr_admin'].includes(session.role)) {
    redirect('/hr');
  }

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Pengaturan Email</h1>
        <p className='text-sm text-slate-500'>
          SMTP pengirim slip gaji otomatis. Ubah tanpa perlu akses server.
        </p>
      </div>
      <SmtpClient />
    </div>
  );
}