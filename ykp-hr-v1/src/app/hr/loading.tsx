import { CardSkeleton, TableSkeleton } from '@/components/skeleton';

export default function Loading() {
  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <div className='h-7 w-56 animate-pulse rounded-md bg-slate-200' />
        <div className='h-4 w-80 animate-pulse rounded-md bg-slate-200' />
      </div>
      <div className='grid gap-4 sm:grid-cols-3'>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className='rounded-lg border border-slate-200 bg-white p-4'>
        <div className='mb-3 h-5 w-32 animate-pulse rounded-md bg-slate-200' />
        <TableSkeleton rows={6} />
      </div>
    </div>
  );
}
