import { getSession } from '@/lib/session';
import { Sidebar } from '@/components/sidebar';
import { redirect } from 'next/navigation';

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <div className='flex min-h-screen bg-slate-50'>
      <a href='#ops-main' className='sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-sky-700 focus:px-3 focus:py-2 focus:text-sm focus:text-white'>Lewati ke konten utama</a>
      <aside className='w-56 shrink-0 border-r border-slate-200 bg-white'>
        <Sidebar role={session.role} userName={session.username} />
      </aside>
      <main id='ops-main' className='flex-1 p-6'>{children}</main>
    </div>
  );
}
