import { getSession } from '@/lib/session';
import { Sidebar } from '@/components/sidebar';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <div className='flex min-h-screen'>
      <Sidebar role={session.role} userName={session.username} />
      <main className='flex-1 bg-slate-50 px-4 pb-6 pt-20 md:px-6 md:pt-6'>{children}</main>
    </div>
  );
}
