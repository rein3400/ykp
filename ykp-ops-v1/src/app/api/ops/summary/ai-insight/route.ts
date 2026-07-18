import { NextRequest } from 'next/server';
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { ok, unauthorized, forbidden, badRequest, notFound, handler } from '@/lib/http';
import { aiHealth } from '@/lib/ai';
import { generateSummaryInsight } from '@/lib/ai-analytics';
import { nowTimestampWib } from '@/lib/format';

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'generate', 'analytics')) return forbidden();
  if (!aiHealth().configured) {
    return badRequest('AI provider not configured');
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const summaryId = body.summary_id;
  if (!summaryId) return badRequest('summary_id required');
  const found = await findRow(TABS.summary, 'summary_id', summaryId);
  if (!found) return notFound('summary not found');

  const insight = await generateSummaryInsight(found.row);
  const updated = {
    ...found.row,
    ai_insight: insight,
    ai_insight_generated_at: nowTimestampWib(),
  };
  await updateRow(TABS.summary, found.rowIndex, updated);
  return ok({ summary_id: summaryId, ai_insight: insight, generated_at: updated.ai_insight_generated_at });
});
