/** Cross-module alert inbox — severity sorted, deep links into owning module. */
import type { OwnerAlert } from '@/lib/types';
import { MODULES } from '@/lib/modules';
import { SeverityChip, ModuleChip, EmptyState, Card } from './ui';
import { formatTimeHm } from '@/lib/format';

export function AlertInbox({ alerts }: { alerts: OwnerAlert[] }) {
  return (
    <Card title={`Inbox Alert (${alerts.length})`}>
      {alerts.length === 0 ? (
        <EmptyState message='Tidak ada alert terbuka — semua modul bersih. 🎉' />
      ) : (
        <ul className='divide-y divide-border'>
          {alerts.map((a) => (
            <li key={a.id} className='flex items-start gap-2 py-2'>
              <div className='flex shrink-0 flex-col items-start gap-1 pt-0.5'>
                <SeverityChip severity={a.severity} />
                <ModuleChip module={a.module} label={MODULES[a.module].label} />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='text-xs font-medium leading-snug'>{a.message || a.title}</p>
                <p className='mt-0.5 text-[10px] text-muted-foreground'>
                  {a.outlet !== 'ALL' ? a.outlet : a.brand}
                  {a.time ? ` · ${formatTimeHm(a.time)}` : ''}
                </p>
              </div>
              <a
                href={a.deepLink}
                target='_blank'
                rel='noopener noreferrer'
                className='shrink-0 rounded border border-border px-2 py-1 text-[10px] font-medium text-primary hover:bg-muted'
              >
                Tangani ↗
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className='mt-2 text-[10px] text-muted-foreground'>
        Read-only: ACK/resolve dilakukan di modul pemilik alert (doktrin no-write-back).
      </p>
    </Card>
  );
}
