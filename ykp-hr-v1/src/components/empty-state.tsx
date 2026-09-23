import Link from 'next/link';
import * as React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const defaultIcon = (
    <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='h-8 w-8 text-slate-500'>
      <path strokeLinecap='round' strokeLinejoin='round' d='M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' />
    </svg>
  );

  return (
    <div className='flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center'>
      <div className='mb-3'>{icon ?? defaultIcon}</div>
      <h3 className='text-sm font-semibold text-slate-900'>{title}</h3>
      {description && <p className='mt-1 max-w-sm text-sm text-slate-600'>{description}</p>}
      {action && (
        <div className='mt-4'>
          {action.href ? (
            <Link
              href={action.href}
              className='inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800'
            >
              {action.label}
            </Link>
          ) : (
            <button
              type='button'
              onClick={action.onClick}
              className='inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800'
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
