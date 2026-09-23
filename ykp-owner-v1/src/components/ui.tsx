/** Small shared presentational bits (server-component safe). */
import type { ModuleStatus, Severity } from '@/lib/types';
import { STATUS_DOT, STATUS_LABEL } from '@/lib/status';

export function StatusDot({ status }: { status: ModuleStatus }) {
  return (
    <span className='inline-flex items-center gap-1.5'>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />
      <span className='text-[11px] text-slate-600'>{STATUS_LABEL[status]}</span>
    </span>
  );
}

const SEV_STYLE: Record<Severity, string> = {
  CRITICAL: 'bg-destructive text-destructive-foreground',
  HIGH: 'bg-orange-700 text-white',
  MEDIUM: 'bg-warning text-slate-900',
  LOW: 'bg-gray-300 text-gray-700'
};

export function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${SEV_STYLE[severity]}`}>
      {severity}
    </span>
  );
}

const MODULE_STYLE: Record<string, string> = {
  finance: 'bg-emerald-100 text-emerald-800',
  hr: 'bg-sky-100 text-sky-800',
  warehouse: 'bg-amber-100 text-amber-800',
  ops: 'bg-violet-100 text-violet-800',
  investor: 'bg-rose-100 text-rose-800'
};

export function ModuleChip({ module, label }: { module: string; label: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${MODULE_STYLE[module] ?? 'bg-gray-200 text-gray-700'}`}>
      {label}
    </span>
  );
}

export function Card({ title, children, action }: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className='rounded-lg border border-border bg-background p-4 shadow-sm'>
      {(title || action) && (
        <header className='mb-3 flex items-center justify-between'>
          <h2 className='text-sm font-bold'>{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className='rounded border border-dashed border-border p-6 text-center text-xs text-muted-foreground'>
      {message}
    </div>
  );
}

export function SourceTag({ source, updatedAt }: { source: string; updatedAt: string }) {
  return (
    <p className='mt-2 text-[10px] text-muted-foreground'>
      Sumber: {source}{updatedAt ? ` · update ${updatedAt}` : ''}
    </p>
  );
}

export function SkeletonRows({ n = 3 }: { n?: number }) {
  return (
    <div className='space-y-2'>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className='h-10 animate-pulse rounded bg-muted' />
      ))}
    </div>
  );
}
