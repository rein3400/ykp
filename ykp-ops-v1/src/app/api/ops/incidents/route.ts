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
import { getOutletName } from '@/lib/repo';

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
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.outlet_id || !body.title) return badRequest('outlet_id and title required');
  const outlet = await findRow(TABS.outlets, 'outlet_id', body.outlet_id);
  if (!outlet) return badRequest('outlet not found');
  const id = nextSequentialIdSync('INC');
  const row = {
    incident_id: id,
    date: todayWib(),
    brand_id: outlet.row.brand_id,
    outlet_id: body.outlet_id,
    shift_id: body.shift_id ?? '',
    incident_type: body.incident_type || 'OPERATIONAL',
    severity: body.severity || 'MEDIUM',
    title: body.title,
    description: body.description ?? body.title,
    photo_url: body.photo_url ?? '',
    customer_name: body.customer_name ?? '',
    channel: body.channel ?? '',
    status: 'OPEN',
    assigned_to: body.assigned_to ?? '',
    resolution_notes: '',
    ai_triage: '',
    ai_sentiment: '',
    ai_response_draft: '',
    ai_generated_at: '',
    resolved_at: '',
    created_by: s.userId,
    created_at: nowTimestampWib(),
  };

  // Optional auto-triage for complaints when AI is configured
  if (row.incident_type === 'COMPLAINT' && aiHealth().configured) {
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
  return ok(row, 201);
});
