import type { Metadata } from 'next';
import { ImportEmployees } from '@/features/hr/components/import-employees';

export const metadata: Metadata = {
  title: 'Import Karyawan — YKP HR V1',
  description: 'Import massal karyawan YKP HR V1 dari file CSV.',
};

export default function ImportEmployeesPage() {
  return (
    <div className='space-y-4'>
      <h1 className='text-2xl font-bold'>Import Karyawan dari CSV</h1>
      <div className='card max-w-2xl'>
        <ImportEmployees />
      </div>
      <div className='card max-w-2xl'>
        <h2 className='mb-2 font-semibold'>Format CSV</h2>
        <p className='mb-2 text-sm text-muted-foreground'>
          Header: <code>full_name,role,position,brand_id,outlet_id,basic_salary,salary_type,employment_status,join_date</code>
        </p>
        <p className='text-sm text-muted-foreground'>
          Wajib: full_name, outlet_id, basic_salary. brand_id default BR-001 jika kosong.
        </p>
      </div>
    </div>
  );
}