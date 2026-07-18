import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { ok, list, unauthorized, forbidden, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nextSequentialIdSync } from '@/lib/repo';
import { todayWib, nowTimestampWib } from '@/lib/format';
import { analyzeQcPhoto, qcVisionHealth } from '@/lib/ai-vision';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'qc')) return forbidden();
  return list(await readTab(TABS.qc));
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'qc')) return forbidden();
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.outlet_id) return badRequest('outlet_id required');
  const outlet = await findRow(TABS.outlets, 'outlet_id', body.outlet_id);
  if (!outlet) return badRequest('outlet not found');
  const product = body.product_id ? await findRow(TABS.products, 'product_id', body.product_id) : null;
  const score = Number(body.score || 0);
  const max = Number(body.max_score || 5);
  const ratio = max > 0 ? score / max : 0;
  let status = 'PASS';
  if (ratio < 0.6) status = 'FAIL';
  else if (ratio < 0.8) status = 'NEEDS_REVIEW';
  const id = nextSequentialIdSync('QC');
  const row = {
    qc_id: id,
    date: todayWib(),
    brand_id: outlet.row.brand_id,
    outlet_id: body.outlet_id,
    shift_id: body.shift_id ?? '',
    product_id: body.product_id ?? '',
    product_name: product?.row.product_name ?? body.product_name ?? '',
    batch_reference: body.batch_reference ?? '',
    qc_category: body.qc_category || 'APPEARANCE',
    reference_standard_id: '',
    photo_url: body.photo_url ?? '',
    score: String(score),
    max_score: String(max),
    status,
    defect_type: body.defect_type ?? '',
    notes: body.notes ?? '',
    reviewed_by: s.userId,
    ai_result: '',
    ai_confidence: '',
    second_opinion_status: '',
    created_at: nowTimestampWib(),
  };

  if (row.photo_url && qcVisionHealth()) {
    try {
      const ai = await analyzeQcPhoto({
        photoUrl: row.photo_url,
        productName: row.product_name,
        qcCategory: row.qc_category,
        humanScore: row.score,
        humanStatus: row.status,
      });
      row.ai_result = ai.ai_assessment;
      row.ai_confidence = String(ai.ai_confidence);
      row.second_opinion_status = ai.ai_assessment === 'UNABLE_TO_ASSESS' ? 'UNABLE_TO_ASSESS' : ai.ai_assessment === row.status ? 'AGREE' : 'DISAGREE';
      row.notes = row.notes ? `${row.notes}; AI: ${ai.ai_notes}` : `AI: ${ai.ai_notes}`;
      if (ai.defects_detected.length > 0) {
        row.defect_type = row.defect_type ? `${row.defect_type}, ${ai.defects_detected.join(', ')}` : ai.defects_detected.join(', ');
      }
    } catch (e) {
      console.error('[qc-vision] failed:', e);
      row.second_opinion_status = 'ERROR';
    }
  }

  await appendRows(TABS.qc, [row]);
  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'create',
    entity: 'qc',
    entityId: id,
    afterValue: JSON.stringify(row),
  }).catch(() => null);
  return ok(row, 201);
});
