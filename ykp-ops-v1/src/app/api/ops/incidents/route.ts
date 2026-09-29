import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { ok, list, unauthorized, forbidden, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nextSequentialIdSync } from '@/lib/repo';
import { todayWib, nowTimestampWib } from '@/lib/format';
import { aiHealth } from '@/lib/ai';
import { analyzeIncident, type IncidentAiInput } from '@/lib/ai-incident';
import { pushAlertNotification } from '@/lib/telegram';
import { z } from 'zod';

const INCIDENT_TYPES = ['OPERATIONAL', 'COMPLAINT', 'SAFETY', 'EQUIPMENT', 'OTHER'] as const;
const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const createSchema = z.object({
  outlet_id: z.string().trim().min(1, 'outlet_id required').max(64),
  title: z.string().trim().min(1, 'title required').max(200),
  description: z.string().max(2000).optional(),
  shift_id: z.string().trim().max(64).optional(),
  incident_type: z.enum(INCIDENT_TYPES).default('OPERATIONAL'),
  severity: z.enum(INCIDENT_SEVERITIES).default('MEDIUM'),
  photo_url: z.string().max(500).optional(),
  customer_name: z.string().trim().max(120).optional(),
  channel: z.string().trim().max(60).optional(),
  assigned_to: z.string().trim().max(64).optional(),
});

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'incident')) return forbidden();
  return list(await readTab(TABS.incidents));
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'incident')) return forbidden();
  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'invalid body');
  const body2 = parsed.data;
  const outlet = await findRow(TABS.outlets, 'outlet_id', body2.outlet_id);
  if (!outlet) return badRequest('outlet not found');
  const id = nextSequentialIdSync('INC');
  const row = {
    incident_id: id,
    date: todayWib(),
    brand_id: outlet.row.brand_id,
    outlet_id: body2.outlet_id,
    shift_id: body2.shift_id ?? '',
    incident_type: body2.incident_type,
    severity: body2.severity,
    title: body2.title,
    description: body2.description ?? body2.title,
    photo_url: body2.photo_url ?? '',
    customer_name: body2.customer_name ?? '',
    channel: body2.channel ?? '',
    status: 'OPEN',
    assigned_to: body2.assigned_to ?? '',
    resolution_notes: '',
    ai_triage: '',
    ai_sentiment: '',
    ai_response_draft: '',
    ai_generated_at: '',
    resolved_at: '',
    created_by: s.userId,
    created_at: nowTimestampWib(),
  };

  // ai_generated_at = 'SKIPPED:REASON' marks an un-run triage (vs. timestamp = run).
  let aiSkippedReason = '';
  if (row.incident_type === 'COMPLAINT') {
    if (!aiHealth().configured) {
      row.ai_generated_at = 'SKIPPED:AI_NOT_CONFIGURED';
      aiSkippedReason = 'AI_NOT_CONFIGURED';
    } else {
      try {
        const input: IncidentAiInput = {
          incident_id: id,
          incident_type: row.incident_type,
          severity: row.severity,
          title: row.title,
          description: row.description,
          customer_name: row.customer_name,
          channel: row.channel,
          outlet_name: outlet.row.outlet_name,
        };
        const ai = await analyzeIncident(input);
        row.ai_triage = JSON.stringify(ai.triage);
        row.ai_sentiment = JSON.stringify(ai.sentiment);
        row.ai_response_draft = ai.response_draft;
        row.ai_generated_at = nowTimestampWib();
        if (['HIGH', 'CRITICAL'].includes(ai.triage.suggested_severity)) {
          row.severity = ai.triage.suggested_severity;
        }
      } catch (e) {
        console.error('[incident-ai] auto-triage failed:', e);
        row.ai_generated_at = 'SKIPPED:AI_ERROR';
        aiSkippedReason = 'AI_ERROR';
      }
    }
  }

  await appendRows(TABS.incidents, [row]);
  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'create',
    entity: 'incident',
    entityId: id,
    afterValue: JSON.stringify(row),
  }).catch(() => null);

  // HIGH/CRITICAL incidents: mirror to ops_hermes_alert_log (Hermez read path)
  // before the Telegram push. The tab was defined but never written before.
  if (['HIGH', 'CRITICAL'].includes(row.severity)) {
    const alertRow = {
      alert_id: `ALR-${id}`,
      date: row.date,
      severity: row.severity,
      alert_type: row.incident_type,
      title: row.title,
      message: row.description,
      status: 'OPEN',
      assigned_to: row.assigned_to,
      action_taken: '',
      created_at: row.created_at,
      resolved_at: '',
    };
    await appendRows(TABS.hermezAlerts, [alertRow]).catch((e) =>
      console.error('[incident] failed to write hermes alert log:', e)
    );
    console.log(JSON.stringify({ event: 'ops_alert', alertId: alertRow.alert_id, severity: row.severity, incidentId: id, outletId: row.outlet_id, aiTriage: row.ai_generated_at }));
  }

  await pushAlertNotification('ops', {
    alertId: id,
    alertType: row.incident_type,
    severity: row.severity,
    title: row.title,
    message: row.description,
    outletName: outlet.row.outlet_name,
    date: row.date,
  });

  return ok({ ...row, ai_triage_skipped: aiSkippedReason || undefined }, 201);
});
