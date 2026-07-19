/**
 * /owner/brief — Daily Brief composer. Server-side aggregation into the
 * Hermez brief format, rendered in-app with copy-to-clipboard.
 * Read-only: no Telegram send (the sibling Hermez worker owns delivery).
 */
import { getOverview } from '@/lib/aggregate';
import { composeBrief } from '@/lib/brief';
import { formatDateShort } from '@/lib/format';
import { Card } from '@/components/ui';
import { CopyButton } from '@/components/copy-button';
import { MockBanner } from '@/components/banners';

export const dynamic = 'force-dynamic';

const LEVEL_STYLE = {
  green: 'bg-success text-white',
  yellow: 'bg-warning text-white',
  red: 'bg-destructive text-destructive-foreground'
} as const;

export default async function BriefPage() {
  const ov = await getOverview();
  const brief = composeBrief(ov);

  return (
    <>
      {ov.mock && <MockBanner forced={ov.mockForced} />}
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-bold'>Daily Brief — {formatDateShort(ov.date)}</h1>
        <span className={`rounded px-2 py-1 text-xs font-bold ${LEVEL_STYLE[brief.alertLevel]}`}>
          {brief.alertLevel.toUpperCase()}
        </span>
      </div>

      <Card
        title={`${brief.alertCount} alert terbuka`}
        action={<CopyButton text={brief.text} />}
      >
        <pre className='whitespace-pre-wrap rounded bg-muted p-3 font-mono text-xs leading-relaxed'>
          {brief.text}
        </pre>
        <p className='mt-2 text-[10px] text-muted-foreground'>
          Format Hermez (plain text, siap Telegram). Read-only — pengiriman Telegram
          dijalankan worker Hermez terpisah, bukan dashboard ini.
        </p>
      </Card>
    </>
  );
}
