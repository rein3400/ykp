import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { ok, unauthorized, forbidden, badRequest, handler } from '@/lib/http';
import { aiHealth } from '@/lib/ai';
import { askOpsAssistant } from '@/lib/ai-assistant';

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'analytics')) return forbidden();
  if (!aiHealth().configured) {
    return badRequest('AI provider not configured');
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const question = body.question?.trim();
  if (!question) return badRequest('question required');
  const answer = await askOpsAssistant({ question, context: body.context });
  return ok({ question, answer });
});
