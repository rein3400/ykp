import { getSession } from '@/lib/session';
import { Sidebar } from '@/components/sidebar';
import { redirect } from 'next/navigation';

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <div className='flex min-h-screen bg-slate-50'>
      <aside className='w-56 shrink-0 border-r border-slate-200 bg-white'>
        <Sidebar role={session.role} userName={session.username} />
      </aside>
      <main className='flex-1 p-6'>{children}</main>
    </div>
  );
}
