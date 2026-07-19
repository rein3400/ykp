import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ExpensesClient from './expenses-client';

export const dynamic = 'force-dynamic';

export default async function ExpensesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [brands, outlets, categories, methods, expenses] = await Promise.all([
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.expenseCategories),
    readTab<Record<string, string>>(TABS.paymentMethods),
    readTab<Record<string, string>>(TABS.expense)
  ]);
  return (
    <ExpensesClient
      brands={brands}
      outlets={outlets}
      categories={categories}
      methods={methods}
      expenses={expenses}
      role={session.role}
    />
  );
}
