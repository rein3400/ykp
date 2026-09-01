import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ShiftsClient from './shifts-client';

export const dynamic = 'force-dynamic';

export default async function ShiftsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['owner', 'super_admin', 'hr_admin'].includes(session.role)) {
    redirect('/hr');
  }

  const shifts = await readTab<Record<string, string>>(TABS.shifts);
  const sorted = [...shifts].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Kelola Shift</h1>
        <p className='text-sm text-slate-500'>
          Atur jam shift untuk roster. Shift nonaktif tidak hilang — riwayat roster &amp; absensi tetap tersimpan.
        </p>
      </div>
      <ShiftsClient shifts={sorted} />
    </div>
  );
}