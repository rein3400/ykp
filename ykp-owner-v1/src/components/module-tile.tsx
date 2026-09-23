/** Module tile for the command home — status dot, 3 headline KPIs, deep link. */
import Link from 'next/link';
import type { ModuleResult } from '@/lib/types';
import { StatusDot } from './ui';
import { formatTimeHm } from '@/lib/format';

export interface TileKpi {
  label: string;
  value: string;
}

export function ModuleTile({ mod, kpis, href }: {
  mod: ModuleResult;
  kpis: TileKpi[];
  href: string;
}) {
  const updated = formatTimeHm(
    mod.rows[0]?.created_at ?? mod.rows[0]?.generated_at ?? ''
  );
  return (
    <div className='flex min-w-[220px] flex-col rounded-lg border border-border bg-background p-3 shadow-sm'>
      <div className='mb-2 flex items-center justify-between'>
        <span className='text-sm font-bold'>{mod.label}</span>
        <StatusDot status={mod.status} />
      </div>
      {mod.status === 'offline' ? (
        <p className='flex-1 text-[11px] text-destructive'>
          Modul tidak bisa dihubungi{mod.error ? ` (${mod.error})` : ''}
        </p>
      ) : (
        <dl className='flex-1 space-y-1'>
          {kpis.map((k) => (
            <div key={k.label} className='flex items-baseline justify-between gap-2'>
              <dt className='text-[11px] text-muted-foreground'>{k.label}</dt>
              <dd className='text-xs font-semibold'>{k.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className='mt-2 flex items-center justify-between border-t border-border pt-2'>
        <span className='text-[10px] text-muted-foreground'>
          {updated ? `updated ${updated}` : mod.summaryDate ?? '—'}
        </span>
        <div className='flex gap-2 text-[11px]'>
          <Link href={href} className='font-medium text-primary underline-offset-2 hover:underline'>
            {mod.label}
          </Link>
          <a
            href={mod.deepLink}
            target='_blank'
            rel='noopener noreferrer'
            className='font-medium text-primary underline-offset-2 hover:underline'
          >
            Buka ↗
          </a>
        </div>
      </div>
    </div>
  );
}
