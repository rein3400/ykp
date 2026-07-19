/** /owner/health — per-app health: reachability, ping ms, record counts, last summary date. */
import { getOverview } from '@/lib/aggregate';
import { MODULES, moduleUrl } from '@/lib/modules';
import { formatDateShort } from '@/lib/format';
import { Card, StatusDot } from '@/components/ui';
import { MockBanner } from '@/components/banners';

export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  const ov = await getOverview();

  return (
    <>
      {ov.mock && <MockBanner forced={ov.mockForced} />}
      <h1 className='text-lg font-bold'>Health Modul</h1>
      <Card>
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-xs'>
            <thead>
              <tr className='border-b border-border text-[10px] uppercase text-muted-foreground'>
                <th className='py-1.5 pr-3 font-medium'>Modul</th>
                <th className='py-1.5 pr-3 font-medium'>Status</th>
                <th className='py-1.5 pr-3 font-medium'>Ping</th>
                <th className='py-1.5 pr-3 font-medium'>Summary terakhir</th>
                <th className='py-1.5 pr-3 font-medium'>Record count</th>
                <th className='py-1.5 pr-3 font-medium'>Base URL</th>
                <th className='py-1.5 font-medium'>Error</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(ov.modules).map((m) => (
                <tr key={m.key} className='border-b border-border last:border-0'>
                  <td className='py-2 pr-3 font-semibold'>{m.label}</td>
                  <td className='py-2 pr-3'><StatusDot status={m.status} /></td>
                  <td className='py-2 pr-3'>{m.latencyMs !== null ? `${m.latencyMs} ms` : '—'}</td>
                  <td className='py-2 pr-3'>{m.summaryDate ? formatDateShort(m.summaryDate) : '—'}</td>
                  <td className='py-2 pr-3'>{m.recordCount ?? '—'}</td>
                  <td className='py-2 pr-3'>
                    <a
                      href={moduleUrl(MODULES[m.key], MODULES[m.key].pages.home)}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-primary hover:underline'
                    >
                      {(process.env[MODULES[m.key].envVar] ?? MODULES[m.key].defaultUrl).replace(/^https?:\/\//, '')} ↗
                    </a>
                  </td>
                  <td className='py-2 text-destructive'>{m.error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className='mt-2 text-[10px] text-muted-foreground'>
          Record count dari endpoint publik /summary/count tiap modul.
          Ping diukur saat fetch summary (timeout 4 detik).
        </p>
      </Card>
    </>
  );
}
