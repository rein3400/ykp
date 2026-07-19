'use client';

import * as React from 'react';

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[hr] dashboard error', error);
  }, [error]);

  return (
    <div className='flex min-h-[60vh] items-center justify-center'>
      <div className='w-full max-w-md rounded-lg border border-rose-200 bg-rose-50 p-6 text-center'>
        <div className='mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100'>
          <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='h-6 w-6 text-rose-700'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' />
          </svg>
        </div>
        <h2 className='text-base font-semibold text-rose-900'>Terjadi kesalahan</h2>
        <p className='mt-1 text-sm text-rose-700'>
          {error.message || 'Halaman gagal dimuat. Coba lagi.'}
        </p>
        {error.digest && (
          <p className='mt-1 font-mono text-[10px] text-rose-600'>ref: {error.digest}</p>
        )}
        <button
          type='button'
          onClick={reset}
          className='mt-4 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700'
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
