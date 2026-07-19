/**
 * POST /api/hr/lateness/approve — approve or reject one hr_lateness row.
 * Roles: owner / super_admin / hr_admin ('approve' on 'lateness' in the RBAC
 * matrix). Updates approval_status + approved_by and writes an audit entry.
 * Follows the leaves/adjustments approval pattern.
 */
import { updateRow, TABS, findRow } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, forbidden, conflict, ok, notFound } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nextApprovalStatus, type ApprovalDecision } from '@/features/hr/lib/lateness';
import { z } from 'zod';

const schema = z.object({
  lateness_id: z.string().min(1),
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().default('')
});

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'approve', 'lateness')) return forbidden();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const found = await findRow(TABS.lateness, 'lateness_id', parsed.data.lateness_id);
  if (!found) return notFound('Lateness not found');

  let nextStatus: string;
  try {
    nextStatus = nextApprovalStatus(found.row.approval_status, parsed.data.decision as ApprovalDecision);
  } catch {
    return conflict('Lateness already decided');
  }

  const updated = {
    ...found.row,
    approval_status: nextStatus,
    approved_by: session.userId
  };
  await updateRow(TABS.lateness, found.rowNumber, updated);
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: parsed.data.decision === 'APPROVE' ? 'approve' : 'reject',
    entity: 'lateness',
    entityId: parsed.data.lateness_id,
    reason: parsed.data.reason
  });
  return ok(updated);
});
