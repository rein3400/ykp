/** /owner/activity — unified audit trail across all modules (read-only). */
import { getActivityFeed, type OwnerActivityItem } from '@/lib/activity';
import { MODULE_KEYS, type ModuleKey } from '@/lib/types';
import { MODULES } from '@/lib/modules';
import { isMockForced } from '@/lib/aggregate';
import { Card, EmptyState, ModuleChip } from '@/components/ui';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 300;

const ACTION_STYLE: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-800',
  update: 'bg-amber-100 text-amber-800',
  delete: 'bg-red-100 text-red-800',
  approve: 'bg-sky-100 text-sky-800',
  reject: 'bg-red-100 text-red-800',
  import: 'bg-violet-100 text-violet-800'
};

function filterItems(
  items: OwnerActivityItem[],
  f: { action: string; user: string }
): OwnerActivityItem[] {
  const user = f.user.trim().toLowerCase();
  return items.filter(
    (it) => (!f.action || it.action === f.action) && (!user || it.user.toLowerCase().includes(user))
  );
}

function Diff({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  let pretty = value;
  try {
    pretty = JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    /* keep raw */
  }
  return (
    <div>
      <p className='text-[10px] font-semibold uppercase text-muted-foreground'>{label}</p>
      <pre className='mt-0.5 max-h-48 overflow-auto rounded bg-muted p-2 text-[10px] whitespace-pre-wrap break-all'>
        {pretty}
      </pre>
    </div>
  );
}

export default async function ActivityPage({
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
  const moduleFilter = (MODULE_KEYS as string[]).includes(moduleParam)
    ? (moduleParam as ModuleKey)
    : '';
  const actionFilter = pick('action');
  const userFilter = pick('user');
  const from = pick('from');
  const to = pick('to');

  if (isMockForced()) {
    return (
      <>
        <h1 className='text-lg font-bold'>Aktivitas</h1>
        <EmptyState message='Mode mock aktif — audit trail tidak tersedia.' />
      </>
    );
  }

  const feed = await getActivityFeed({
    from: from || undefined,
    to: to || undefined,
    modules: moduleFilter ? [moduleFilter] : undefined
  });
  const actions = [...new Set(feed.items.map((i) => i.action).filter(Boolean))].sort();
  const filtered = filterItems(feed.items, { action: actionFilter, user: userFilter });
  const shown = filtered.slice(0, PAGE_SIZE);

  return (
    <>
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-bold'>Aktivitas — semua aksi user</h1>
        <span className='text-[11px] text-muted-foreground'>{filtered.length} entri</span>
      </div>

      {feed.unavailable.length > 0 && (
        <p className='rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800'>
          Modul tidak terjangkau (feed parsial):{' '}
          {feed.unavailable.map((m) => m.label).join(', ')}
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
              {MODULE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {MODULES[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className='text-[11px] text-muted-foreground'>
            Aksi
            <select
              name='action'
              defaultValue={actionFilter}
              className='mt-0.5 block rounded border border-border bg-background px-2 py-1.5 text-xs'
            >
              <option value=''>Semua</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className='text-[11px] text-muted-foreground'>
            User
            <input
              name='user'
              type='text'
              defaultValue={userFilter}
              placeholder='user_id'
              className='mt-0.5 block w-28 rounded border border-border bg-background px-2 py-1.5 text-xs'
            />
          </label>
          <label className='text-[11px] text-muted-foreground'>
            Dari
            <input
              name='from'
              type='date'
              defaultValue={from}
              className='mt-0.5 block rounded border border-border bg-background px-2 py-1.5 text-xs'
            />
          </label>
          <label className='text-[11px] text-muted-foreground'>
            Sampai
            <input
              name='to'
              type='date'
              defaultValue={to}
              className='mt-0.5 block rounded border border-border bg-background px-2 py-1.5 text-xs'
            />
          </label>
          <button
            type='submit'
            className='rounded bg-foreground px-3 py-1.5 text-xs font-semibold text-background'
          >
            Terapkan
          </button>
        </form>
      </Card>

      <Card title='Audit trail'>
        {shown.length === 0 ? (
          <EmptyState message='Tidak ada aktivitas untuk filter ini.' />
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-xs'>
              <thead>
                <tr className='border-b border-border text-[10px] uppercase text-muted-foreground'>
                  <th className='py-1.5 pr-3 font-medium'>Waktu</th>
                  <th className='py-1.5 pr-3 font-medium'>Modul</th>
                  <th className='py-1.5 pr-3 font-medium'>User</th>
                  <th className='py-1.5 pr-3 font-medium'>Aksi</th>
                  <th className='py-1.5 pr-3 font-medium'>Entitas</th>
                  <th className='py-1.5 pr-3 font-medium'>Detail</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((it, i) => (
                  <tr
                    key={it.id || `${it.module}-${it.time}-${i}`}
                    className='border-b border-border/50 align-top'
                  >
                    <td className='py-1.5 pr-3 whitespace-nowrap text-muted-foreground'>
                      {it.time || '—'}
                    </td>
                    <td className='py-1.5 pr-3'>
                      <ModuleChip module={it.module} label={it.moduleLabel} />
                    </td>
                    <td className='py-1.5 pr-3'>
                      {it.user || '—'}
                      {it.role && (
                        <span className='block text-[10px] text-muted-foreground'>{it.role}</span>
                      )}
                    </td>
                    <td className='py-1.5 pr-3'>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          ACTION_STYLE[it.action] ?? 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {it.action}
                      </span>
                    </td>
                    <td className='py-1.5 pr-3'>
                      {it.recordType}
                      {it.recordId && (
                        <span className='block text-[10px] text-muted-foreground'>
                          {it.recordId}
                        </span>
                      )}
                    </td>
                    <td className='py-1.5 pr-3'>
                      {(it.reason || it.beforeValue || it.afterValue) && (
                        <details>
                          <summary className='cursor-pointer text-[11px] text-muted-foreground hover:text-foreground'>
                            lihat
                          </summary>
                          <div className='mt-1 space-y-2'>
                            {it.reason && (
                              <p className='text-[11px] italic text-muted-foreground'>
                                “{it.reason}”
                              </p>
                            )}
                            <Diff label='Sebelum' value={it.beforeValue} />
                            <Diff label='Sesudah' value={it.afterValue} />
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > PAGE_SIZE && (
              <p className='mt-2 text-[10px] text-muted-foreground'>
                Menampilkan {PAGE_SIZE} dari {filtered.length} entri — persempit filter tanggal.
              </p>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
