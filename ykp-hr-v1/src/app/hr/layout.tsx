import { getSession } from '@/lib/session';
import { Sidebar } from '@/components/sidebar';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <div className='flex min-h-screen'>
      <aside className='w-64 border-r border-border bg-background'>
        <Sidebar role={session.role} />
      </aside>
      <main className='flex-1 p-6'>{children}</main>
    </div>
  );
}