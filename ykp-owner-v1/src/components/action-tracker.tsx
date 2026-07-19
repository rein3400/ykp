/** Cross-module OPEN/OVERDUE action tracker. */
import type { OwnerAction } from '@/lib/types';
import { MODULES } from '@/lib/modules';
import { ModuleChip, EmptyState, Card } from './ui';
import { formatDateShort } from '@/lib/format';

export function ActionTracker({ actions }: { actions: OwnerAction[] }) {
  return (
    <Card title={`Action Tracker (${actions.length} terbuka)`}>
      {actions.length === 0 ? (
        <EmptyState message='Tidak ada action terbuka / overdue.' />
      ) : (
        <ul className='divide-y divide-border'>
          {actions.map((a) => (
            <li key={a.id} className='flex items-start gap-2 py-2'>
              <div className='flex shrink-0 flex-col items-start gap-1 pt-0.5'>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${a.overdue ? 'bg-destructive text-destructive-foreground' : 'bg-sky-100 text-sky-800'}`}>
                  {a.overdue ? 'OVERDUE' : a.status}
                </span>
                <ModuleChip module={a.module} label={MODULES[a.module].label} />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='text-xs font-medium leading-snug'>{a.title}</p>
                <p className='mt-0.5 text-[10px] text-muted-foreground'>
                  PIC: {a.pic || '—'}
                  {a.dueDate ? ` · deadline ${formatDateShort(a.dueDate)}` : ''}
                  {a.outlet !== 'ALL' ? ` · ${a.outlet}` : ''}
                </p>
              </div>
              <a
                href={a.deepLink}
                target='_blank'
                rel='noopener noreferrer'
                className='shrink-0 rounded border border-border px-2 py-1 text-[10px] font-medium text-primary hover:bg-muted'
              >
                Buka ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
