import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { ChangePasswordForm } from '@/features/auth/change-password-form';

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100 px-4'>
      <div className='w-full max-w-sm'>
        <div className='mb-6 text-center'>
          <div className='mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-sky-700 text-2xl font-bold text-white shadow-lg'>Y</div>
          <h1 className='text-2xl font-bold tracking-tight text-slate-900'>Ganti Password</h1>
          <p className='mt-1 text-sm text-slate-600'>
            {session.mustChangePassword
              ? 'Anda harus mengganti password sebelum melanjutkan.'
              : 'Perbarui password akun Anda.'}
          </p>
        </div>

        <div className='rounded-xl border border-slate-200 bg-white p-6 shadow-lg'>
          <ChangePasswordForm />
        </div>

        <p className='mt-6 text-center text-xs text-slate-500'>
          YKP Hermez AI Command Center · HR Module V1
        </p>
      </div>
    </div>
  );
}
