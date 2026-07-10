import { findRow, TABS } from '@/db/sheets';
import { EmployeeForm } from '@/features/hr/components/employee-form';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await findRow(TABS.employees, 'employee_id', id);
  if (!found) notFound();

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Edit Karyawan</h1>
        <p className='text-sm text-muted-foreground'>
          Perubahan akan dicatat di audit log. ID tidak dapat diubah.
        </p>
      </div>
      <div className='card max-w-2xl'>
        <EmployeeForm initial={found.row} mode='edit' />
      </div>
    </div>
  );
}