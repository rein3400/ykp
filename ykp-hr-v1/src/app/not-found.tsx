import Link from 'next/link';

export default function NotFound() {
  return (
    <div className='flex min-h-screen items-center justify-center bg-slate-50 px-4'>
      <div className='w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm'>
        <div className='mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100'>
          <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='h-6 w-6 text-slate-500'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' />
          </svg>
        </div>
        <h1 className='text-xl font-bold text-slate-900'>404</h1>
        <p className='mt-1 text-sm text-slate-600'>Halaman tidak ditemukan.</p>
        <Link
          href='/hr'
          className='mt-4 inline-block rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800'
        >
          Kembali ke Ringkasan
        </Link>
      </div>
    </div>
  );
}
