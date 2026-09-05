import { getSession } from '@/lib/session';
import { Sidebar } from '@/components/sidebar';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.mustChangePassword) redirect('/change-password');
  return (
    <div className='flex min-h-screen'>
      <a href='#hr-main' className='sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-sky-700 focus:px-3 focus:py-2 focus:text-sm focus:text-white'>Lewati ke konten utama</a>
      <Sidebar role={session.role} userName={session.username} />
      <main id='hr-main' className='flex-1 bg-slate-50 px-4 pb-6 pt-20 md:px-6 md:pt-6'>{children}</main>
    </div>
  );
}
