import { clearSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export async function POST() {
  await clearSession();
  redirect('/login');
}
