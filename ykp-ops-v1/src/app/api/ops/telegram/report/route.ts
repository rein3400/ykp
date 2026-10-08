/**
 * POST /api/ops/telegram/report
 * Bot-authenticated (x-bot-secret). Lets outlet staff report operational events
 * straight from Telegram: menu listing, incident reporting, daily briefing read.
 * Identity is the linked user (users.telegram_id); outlet is scoped + validated.
 */
import { NextRequest } from 'next/server';
import { appendRows, readTab, TABS } from '@/db/sheets';
import { findRow } from '@/db/sheets';
import { handler, ok, badRequest, unauthorized, forbidden } from '@/lib/http';
import { todayWib, nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';
import { logAudit } from '@/lib/audit';
import { opsMenuText, validateIncidentCommand } from '@/lib/ops-telegram';

function botAuthorized(req: Request): boolean {
  const secret = process.env.TELEGRAM_BOT_SECRET;
  if (!secret) return false;
  return (req.headers.get('x-bot-secret') ?? '') === secret;
}

async function resolveLinkedUser(chatId: string): Promise<Record<string, string> | null> {
  const users = await readTab<Record<string, string>>(TABS.users);
  return users.find((u) => (u.telegram_id ?? '').trim() === chatId && (u.active_status || 'active') === 'active') ?? null;
}

export const POST = handler(async (req: NextRequest) => {
  if (!botAuthorized(req)) return unauthorized('Invalid or missing x-bot-secret');
  const body = (await req.json().catch(() => ({}))) as {
    telegram_chat_id?: string;
    action?: string;
    text?: string;
    outlet_id?: string;
  };
  const chatId = (body.telegram_chat_id ?? '').trim();
  if (!chatId) return badRequest('telegram_chat_id required');
  const base = process.env.OPS_PUBLIC_URL || process.env.NEXT_PUBLIC_OPS_URL || '';
  const action = (body.action ?? 'menu').toLowerCase();

  if (action === 'menu') return ok({ text: opsMenuText(base) });

  const user = await resolveLinkedUser(chatId);
  if (!user) return ok({ text: 'Akun Telegram belum terhubung ke user Operasional. Buka aplikasi web → menu Telegram → hubungkan dulu.' });

  if (action === 'briefing') {
    const briefings = (await readTab<Record<string, string>>(TABS.briefing)).filter((b) => b.date === todayWib() && (!user.outlet_id || !b.outlet_id || b.outlet_id === user.outlet_id));
    if (!briefings.length) return ok({ text: 'Belum ada briefing hari ini untuk outlet kamu.' });
    const text = briefings.slice(-1)[0];
    return ok({ text: `<b>📋 Briefing ${text.date}</b>\n${text.briefing_text ?? '-'}` });
  }

  if (action !== 'incident') return badRequest('action tidak dikenal');

  let parsed;
  try {
    parsed = validateIncidentCommand({ title: body.text ?? '', incident_type: undefined, severity: undefined });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Laporan tidak valid');
  }
  const outletId = (body.outlet_id ?? user.outlet_id ?? '').trim();
  if (!outletId) return badRequest('Outlet belum diset pada profil kamu; hubungi HR/SPV.');
  if (user.outlet_id && outletId !== user.outlet_id) return forbidden('Kamu hanya bisa melapor untuk outlet kamu.');
  const outlet = await findRow(TABS.outlets, 'outlet_id', outletId);
  if (!outlet || !['active', '1'].includes((outlet.row.status ?? '').trim().toLowerCase())) return badRequest('Outlet tidak valid/aktif');

  const id = nextSequentialIdSync('INC');
  const row: Record<string, string> = {
    incident_id: id, date: todayWib(), brand_id: outlet.row.brand_id, outlet_id: outletId,
    shift_id: '', incident_type: parsed.incident_type, severity: parsed.severity,
    title: parsed.title, description: parsed.title, photo_url: '', customer_name: '', channel: 'TELEGRAM',
    status: 'OPEN', assigned_to: '', resolution_notes: '', ai_triage: '', ai_sentiment: '',
    ai_response_draft: '', ai_generated_at: '', resolved_at: '', created_by: user.user_id, created_at: nowTimestampWib()
  };
  await appendRows(TABS.incidents, [row]);
  await logAudit({
    actorUserId: user.user_id, actorRole: 'telegram', action: 'create', entity: 'incident',
    entityId: id, afterValue: JSON.stringify(row)
  }).catch(() => null);
  return ok({ text: `✅ Insiden tercatat: ${id}\n${parsed.title} (${parsed.severity})`, incident_id: id });
});
