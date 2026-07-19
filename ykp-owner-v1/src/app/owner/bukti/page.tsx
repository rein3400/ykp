/** /owner/bukti — photo proof gallery across modules (spot-check, read-only). */
import { getGallery } from '@/lib/gallery';
import { MODULE_KEYS, type ModuleKey } from '@/lib/types';
import { MODULES } from '@/lib/modules';
import { isMockForced } from '@/lib/aggregate';
import { Card, EmptyState, ModuleChip } from '@/components/ui';

export const dynamic = 'force-dynamic';

const WITH_ATTACHMENTS = MODULE_KEYS.filter((k) => MODULES[k].attachmentsPath);
const ENTITY_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Semua jenis' },
  { value: 'receiving', label: 'Receiving (timbang)' },
  { value: 'receipt', label: 'Struk ops' },
  { value: 'mou', label: 'MOU investor' }
];

export default async function BuktiPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return typeof v === 'string' ? v.trim() : '';
  };
  const moduleParam = pick('module');
  const moduleFilter = WITH_ATTACHMENTS.includes(moduleParam as ModuleKey)
    ? (moduleParam as ModuleKey)
    : '';
  const entityFilter = pick('entity');

  if (isMockForced()) {
    return (
      <>
        <h1 className='text-lg font-bold'>Bukti Foto</h1>
        <EmptyState message='Mode mock aktif — galeri bukti tidak tersedia.' />
      </>
    );
  }

  const feed = await getGallery({
    modules: moduleFilter ? [moduleFilter] : undefined,
    entityType: entityFilter || undefined
  });

  return (
    <>
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-bold'>Bukti Foto — spot check</h1>
        <span className='text-[11px] text-muted-foreground'>{feed.items.length} foto</span>
      </div>

      {feed.unavailable.length > 0 && (
        <p className='rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800'>
          Modul tidak terjangkau: {feed.unavailable.map((m) => m.label).join(', ')}
        </p>
      )}

      <Card>
        <form method='GET' className='flex flex-wrap items-end gap-2'>
          <label className='text-[11px] text-muted-foreground'>
            Modul
            <select
              name='module'
              defaultValue={moduleFilter}
              className='mt-0.5 block rounded border border-border bg-background px-2 py-1.5 text-xs'
            >
              <option value=''>Semua</option>
              {WITH_ATTACHMENTS.map((k) => (
                <option key={k} value={k}>
                  {MODULES[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className='text-[11px] text-muted-foreground'>
            Jenis
            <select
              name='entity'
              defaultValue={entityFilter}
              className='mt-0.5 block rounded border border-border bg-background px-2 py-1.5 text-xs'
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type='submit'
            className='rounded bg-foreground px-3 py-1.5 text-xs font-semibold text-background'
          >
            Terapkan
          </button>
        </form>
      </Card>

      {feed.items.length === 0 ? (
        <EmptyState message='Belum ada foto bukti untuk filter ini.' />
      ) : (
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
          {feed.items.map((it) => (
            <a
              key={`${it.module}-${it.id}`}
              href={it.url}
              target='_blank'
              rel='noreferrer'
              className='group block overflow-hidden rounded-lg border border-border bg-background shadow-sm'
            >
              <div className='flex h-40 items-center justify-center bg-muted'>
                {it.mock ? (
                  <span className='px-2 text-center text-[10px] text-muted-foreground'>
                    Foto tidak tersimpan (mode mock)
                  </span>
                ) : it.isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.url}
                    alt={it.fileName || it.id}
                    loading='lazy'
                    className='h-full w-full object-cover group-hover:opacity-90'
                  />
                ) : (
                  <span className='text-2xl'>📄</span>
                )}
              </div>
              <div className='space-y-1 p-2'>
                <div className='flex items-center justify-between gap-1'>
                  <ModuleChip module={it.module} label={it.moduleLabel} />
                  <span className='text-[9px] text-muted-foreground'>
                    {it.createdAt.slice(5, 16)}
                  </span>
                </div>
                <p className='truncate text-[11px] font-medium'>
                  {it.entityType}
                  {it.entityId ? ` · ${it.entityId}` : ''}
                </p>
                <p className='truncate text-[10px] text-muted-foreground'>{it.uploadedBy}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
