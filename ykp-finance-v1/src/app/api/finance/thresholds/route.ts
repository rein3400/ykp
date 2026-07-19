/**
 * Threshold config (finance_threshold_config, Revisi #10): stored in Sheets,
 * consumed by the alert engine, editable with audit trail. GET list; POST
 * create (key + human label + explanation + value + unit + severity + scope).
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler, forbidden } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'threshold')) return forbidden('Forbidden');
  const rows = await readTab<Record<string, string>>(TABS.thresholdConfig);
  return list(rows);
});

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const SCOPES = ['GLOBAL', 'BRAND', 'OUTLET'];

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'threshold')) return forbidden('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.key) return badRequest('key is required');
  if (!body.label) return badRequest('label (nama aturan) is required');
  if (!body.value || !Number.isFinite(Number(body.value))) return badRequest('value must be numeric');
  const severity = (body.severity ?? 'MEDIUM').toUpperCase();
  if (!SEVERITIES.includes(severity)) return badRequest(`severity must be one of ${SEVERITIES.join(', ')}`);
  const scope = (body.scope ?? 'GLOBAL').toUpperCase();
  if (!SCOPES.includes(scope)) return badRequest(`scope must be one of ${SCOPES.join(', ')}`);
  if (scope === 'BRAND' && !body.brand_id) return badRequest('brand_id is required for scope BRAND');
  if (scope === 'OUTLET' && !body.outlet_id) return badRequest('outlet_id is required for scope OUTLET');

  const id = nextSequentialIdSync('THR');
  const row: Record<string, string> = {
    threshold_id: id,
    key: body.key,
    label: body.label,
    explanation: body.explanation ?? '',
    value: body.value,
    unit: body.unit ?? '',
    severity,
    scope,
    brand_id: scope === 'BRAND' || scope === 'OUTLET' ? body.brand_id ?? '' : '',
    outlet_id: scope === 'OUTLET' ? body.outlet_id ?? '' : '',
    active: 'true',
    last_changed: nowTimestampWib(),
    changed_by: s.userId
  };
  await appendRows(TABS.thresholdConfig, [row]);
  await logAudit({
    module: 'finance', action: 'create', recordType: 'finance_threshold_config',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
