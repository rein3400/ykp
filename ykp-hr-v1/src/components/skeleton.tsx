export function CardSkeleton() {
  return (
    <div className='rounded-lg border border-slate-200 bg-white p-4'>
      <div className='h-3 w-24 animate-pulse rounded-md bg-slate-200' />
      <div className='mt-2 h-7 w-16 animate-pulse rounded-md bg-slate-200' />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className='space-y-2'>
      <div className='h-9 animate-pulse rounded-md bg-slate-100' />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className='grid gap-2' style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className='h-8 animate-pulse rounded-md bg-slate-100' />
          ))}
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className='space-y-3'>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className='space-y-1'>
          <div className='h-3 w-20 animate-pulse rounded-md bg-slate-200' />
          <div className='h-9 animate-pulse rounded-md bg-slate-100' />
        </div>
      ))}
      <div className='h-9 w-24 animate-pulse rounded-md bg-slate-200' />
    </div>
  );
}
