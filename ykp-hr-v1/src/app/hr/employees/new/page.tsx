import { EmployeeForm } from '@/features/hr/components/employee-form';

export default function NewEmployeePage() {
  return (
    <div className='space-y-4'>
      <h1 className='text-2xl font-bold'>Tambah Karyawan</h1>
      <div className='card max-w-2xl'>
        <EmployeeForm />
      </div>
    </div>
  );
}