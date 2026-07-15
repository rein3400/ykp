import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import UsersClient from './users-client';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['owner', 'super_admin', 'hr_admin'].includes(session.role)) {
    redirect('/hr');
  }

  const [users, brands, outlets] = await Promise.all([
    readTab<Record<string, string>>(TABS.users),
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.outlets)
  ]);

  // Strip password hashes before sending to client
  const safeUsers = users.map(({ password_hash: _p, ...rest }) => rest);

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>User & Role Management</h1>
        <p className='text-sm text-slate-500'>
          Kelola user, role, dan scope brand/outlet. Revisi item 26.
        </p>
      </div>
      <UsersClient users={safeUsers} brands={brands} outlets={outlets} />
    </div>
  );
}
