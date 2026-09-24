/**
 * POST /api/owner/notify/daily-brief
 * Protected by CRON_SECRET header (x-cron-secret or Authorization: Bearer).
 * External scheduler calls this at 22:05 WIB (after the module briefs), taking the
 * SAME composed text as the read-only /owner/brief page and delivering it to the
 * owner broadcast chat. No Sheets log table in this app: result rides the response.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getOverview } from '@/lib/aggregate';
import { composeBrief } from '@/lib/brief';
import { sendOwnerDailyBrief } from '@/lib/telegram';

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function isCronAuthorized(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET ?? '').trim();
  if (!secret) return false;
  const h = req.headers.get('x-cron-secret')?.trim() ?? '';
  if (h) return safeEqual(h, secret);
  const m = (req.headers.get('authorization') ?? '').match(/^Bearer\s+(.+)$/i);
  return m?.[1] ? safeEqual(m[1].trim(), secret) : false;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Invalid or missing CRON_SECRET' } }, { status: 401 });
  }
  const ov = await getOverview();
  const brief = composeBrief(ov);
  const today = ov.date;
  const result = await sendOwnerDailyBrief({ date: today, text: brief.text, sourceReferenceId: `daily-${today}` });
  return NextResponse.json({
    data: {
      date: today,
      alertLevel: brief.alertLevel,
      alertCount: brief.alertCount,
      delivery: result,
      status: result.status === 'SENT' ? 'SENT' : result.status,
    },
  });
}
