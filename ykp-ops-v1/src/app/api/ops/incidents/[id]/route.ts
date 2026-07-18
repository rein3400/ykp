import { NextRequest } from 'next/server';
import { readTab, updateRow, findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { ok, unauthorized, forbidden, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { aiHealth } from '@/lib/ai';
import { analyzeIncident, draftIncidentResponse, type IncidentAiInput } from '@/lib/ai-incident';
import { getOutletName } from '@/lib/repo';

const VALID_STATUSES = ['OPEN', 'INVESTIGATING', 'ACTION_REQUIRED', 'WAITING_APPROVAL', 'RESOLVED', 'CLOSED'];
const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const PATCH = handler(async (req: NextRequest, ctx: { params: Record<string, string> }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'incident')) return forbidden();
  const id = ctx.params.id;
  if (!id) return badRequest('incident id required');
  const found = await findRow(TABS.incidents, 'incident_id', id);
  if (!found) return notFound('incident not found');
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const before = { ...found.row };
  const updates: Record<string, string> = {};

  if (body.status) {
    if (!VALID_STATUSES.includes(body.status)) return badRequest('invalid status');
    updates.status = body.status;
    if (body.status === 'RESOLVED' || body.status === 'CLOSED') {
      updates.resolved_at = nowTimestampWib();
    }
  }
  if (body.severity) {
    if (!VALID_SEVERITIES.includes(body.severity)) return badRequest('invalid severity');
    updates.severity = body.severity;
  }
  if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;
  if (body.resolution_notes !== undefined) updates.resolution_notes = body.resolution_notes;
  if (body.ai_response_draft !== undefined) updates.ai_response_draft = body.ai_response_draft;

  const updated = { ...found.row, ...updates };
  await updateRow(TABS.incidents, found.rowIndex, updated);
  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'update',
    entity: 'incident',
    entityId: id,
    beforeValue: JSON.stringify(before),
    afterValue: JSON.stringify(updated),
  }).catch(() => null);
  return ok(updated);
});

export const POST = handler(async (req: NextRequest, ctx: { params: Record<string, string> }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'incident')) return forbidden();
  const id = ctx.params.id;
  if (!id) return badRequest('incident id required');
  const found = await findRow(TABS.incidents, 'incident_id', id);
  if (!found) return notFound('incident not found');
  if (!aiHealth().configured) {
    return badRequest('AI provider not configured');
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const action = body.action || 'analyze';

  const input: IncidentAiInput = {
    incident_id: found.row.incident_id,
    incident_type: found.row.incident_type,
    severity: found.row.severity,
    title: found.row.title,
    description: found.row.description,
    customer_name: found.row.customer_name,
    channel: found.row.channel,
    outlet_name: await getOutletName(found.row.outlet_id),
  };

  let result: Record<string, unknown>;
  if (action === 'draft') {
    const draft = await draftIncidentResponse(input);
    result = { draft };
  } else {
    const ai = await analyzeIncident(input);
    result = { triage: ai.triage, sentiment: ai.sentiment, response_draft: ai.response_draft };
    await updateRow(TABS.incidents, found.rowIndex, {
      ...found.row,
      ai_triage: JSON.stringify(ai.triage),
      ai_sentiment: JSON.stringify(ai.sentiment),
      ai_response_draft: ai.response_draft,
      ai_generated_at: nowTimestampWib(),
      severity: ['HIGH', 'CRITICAL'].includes(ai.triage.suggested_severity) ? ai.triage.suggested_severity : found.row.severity,
    });
  }

  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'ai_generate',
    entity: 'incident',
    entityId: id,
    afterValue: JSON.stringify({ action, ...result }),
  }).catch(() => null);
  return ok(result);
});
