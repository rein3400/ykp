/**
 * Export active employees as CSV (owner/HR admin only).
 * No PII bank account; include only safe fields.
 */
import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { handler, unauthorized, forbidden } from '@/lib/http';
import { can } from '@/lib/rbac';
import { formatIdr } from '@/lib/format';

function csvEscape(v: string): string {
  const needsQuote = /[",\n]/.test(v);
  return needsQuote ? `"${v.replace(/"/g, '""')}"` : v;
}

export const GET = handler(async () => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as any, 'export', 'employee')) return forbidden();

  const rows = await readTab<{
    employee_id: string;
    full_name: string;
    nickname: string;
    role: string;
    position: string;
    brand_id: string;
    outlet_id: string;
    employment_status: string;
    active_status: string;
    join_date: string;
    basic_salary: string;
    salary_type: string;
  }
  >(TABS.employees);
  const active = rows.filter((r) => r.active_status === 'active' || r.active_status === '1');

  const headers = ['employee_id', 'full_name', 'role', 'position', 'brand_id', 'outlet_id', 'employment_status', 'join_date', 'salary_type', 'basic_salary'];
  const lines = [
    headers.join(','),
    ...active.map((r) =>
      headers
        .map((h) => csvEscape(h === 'basic_salary' ? r[h] : String(r[h as keyof typeof r] ?? '')))
        .join(',')
    )
  ];
  const csv = lines.join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="employees-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
});
