/**
 * Shift swap request + approval (revisi item 11).
 * POST: create swap request between two roster entries.
 * PUT: approve/reject swap.
 */
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, ok, list, badRequest, unauthorized, forbidden, notFound, missingRef } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialId } from '@/lib/repo';

// Ensure swap tab exists in TABS — use roster with swap fields if no dedicated tab
const SWAP_TAB = (TABS as Record<string, string>).shiftSwap ?? 'shift_swap';

export const GET = handler(async () => {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const rows = await readTab<Record<string, string>>(SWAP_TAB as never);
    return list(rows);
  } catch {
    // Tab may not exist yet — return empty
    return list([]);
  }
});

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'create', 'roster')) return forbidden();

  const body = (await req.json().catch(() => ({}))) as {
    roster_id_a: string;
    roster_id_b: string;
    reason?: string;
  };
  if (!body.roster_id_a || !body.roster_id_b) {
    return badRequest('roster_id_a and roster_id_b required');
  }
  if (body.roster_id_a === body.roster_id_b) {
    return badRequest('Cannot swap roster with itself');
  }

  const a = await findRow(TABS.roster, 'roster_id', body.roster_id_a);
  const b = await findRow(TABS.roster, 'roster_id', body.roster_id_b);
  if (!a || !b) return missingRef('One or both roster entries not found');

  // Conflict check: same employee already scheduled on the other date/shift
  if (a.row.employee_id === b.row.employee_id) {
    return badRequest('Both roster entries belong to the same employee');
  }

  // Check date/shift collision after swap
  const allRoster = await readTab<Record<string, string>>(TABS.roster);
  const conflictA = allRoster.find(
    (r) =>
      r.employee_id === a.row.employee_id &&
      r.date === b.row.date &&
      r.shift_id === b.row.shift_id &&
      r.roster_id !== a.row.roster_id &&
      r.roster_status !== 'CANCELLED'
  );
  const conflictB = allRoster.find(
    (r) =>
      r.employee_id === b.row.employee_id &&
      r.date === a.row.date &&
      r.shift_id === a.row.shift_id &&
      r.roster_id !== b.row.roster_id &&
      r.roster_status !== 'CANCELLED'
  );
  if (conflictA || conflictB) {
    return badRequest(
      `Shift conflict detected: ${conflictA ? `employee ${a.row.employee_id} already on ${b.row.date}/${b.row.shift_id}` : ''}` +
      `${conflictB ? ` employee ${b.row.employee_id} already on ${a.row.date}/${a.row.shift_id}` : ''}`
    );
  }

  const now = nowTimestampWib();
  const swapId = await nextSequentialId('roster', 'roster_id', 'SW').catch(() => `SW-${Date.now().toString(36).toUpperCase()}`);

  // Mark both roster rows as SWAP_PENDING
  await updateRow(TABS.roster, a.rowNumber, {
    ...a.row,
    roster_status: 'SWAP_PENDING',
    swap_request_id: swapId,
    notes: `${a.row.notes || ''} [swap→${b.row.employee_id}]`.trim()
  });
  await updateRow(TABS.roster, b.rowNumber, {
    ...b.row,
    roster_status: 'SWAP_PENDING',
    swap_request_id: swapId,
    notes: `${b.row.notes || ''} [swap→${a.row.employee_id}]`.trim()
  });

  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'create',
    entity: 'shift_swap',
    entityId: swapId,
    afterValue: JSON.stringify({
      roster_id_a: body.roster_id_a,
      roster_id_b: body.roster_id_b,
      employee_a: a.row.employee_id,
      employee_b: b.row.employee_id,
      reason: body.reason || '',
      status: 'PENDING',
      created_at: now
    })
  });

  return ok({
    swap_id: swapId,
    status: 'PENDING',
    roster_id_a: body.roster_id_a,
    roster_id_b: body.roster_id_b,
    employee_a: a.row.employee_id,
    employee_b: b.row.employee_id
  }, 201);
});

export const PUT = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'approve', 'roster') && !can(session.role as Role, 'update', 'roster')) {
    return forbidden();
  }

  const body = (await req.json().catch(() => ({}))) as {
    swap_id: string;
    action: 'approve' | 'reject';
  };
  if (!body.swap_id || !body.action) return badRequest('swap_id and action required');

  const allRoster = await readTab<Record<string, string>>(TABS.roster);
  const pending = allRoster.filter((r) => r.swap_request_id === body.swap_id && r.roster_status === 'SWAP_PENDING');
  if (pending.length < 2) return notFound('Swap request not found or already processed');

  const [rowA, rowB] = pending;
  const foundA = await findRow(TABS.roster, 'roster_id', rowA.roster_id);
  const foundB = await findRow(TABS.roster, 'roster_id', rowB.roster_id);
  if (!foundA || !foundB) return notFound('Roster entries missing');

  if (body.action === 'reject') {
    await updateRow(TABS.roster, foundA.rowNumber, { ...foundA.row, roster_status: 'SCHEDULED', swap_request_id: '' });
    await updateRow(TABS.roster, foundB.rowNumber, { ...foundB.row, roster_status: 'SCHEDULED', swap_request_id: '' });
    await logAudit({
      actorUserId: session.userId, actorRole: session.role,
      action: 'reject', entity: 'shift_swap', entityId: body.swap_id
    });
    return ok({ swap_id: body.swap_id, status: 'REJECTED' });
  }

  // Approve: swap employee assignments
  const empA = {
    employee_id: foundA.row.employee_id,
    employee_name: foundA.row.employee_name,
    role: foundA.row.role,
    brand_id: foundA.row.brand_id,
    outlet_id: foundA.row.outlet_id
  };
  const empB = {
    employee_id: foundB.row.employee_id,
    employee_name: foundB.row.employee_name,
    role: foundB.row.role,
    brand_id: foundB.row.brand_id,
    outlet_id: foundB.row.outlet_id
  };

  await updateRow(TABS.roster, foundA.rowNumber, {
    ...foundA.row,
    ...empB,
    roster_status: 'SCHEDULED',
    swap_request_id: body.swap_id,
    approved_by: session.userId,
    replacement_employee_id: empA.employee_id
  });
  await updateRow(TABS.roster, foundB.rowNumber, {
    ...foundB.row,
    ...empA,
    roster_status: 'SCHEDULED',
    swap_request_id: body.swap_id,
    approved_by: session.userId,
    replacement_employee_id: empB.employee_id
  });

  await logAudit({
    actorUserId: session.userId, actorRole: session.role,
    action: 'approve', entity: 'shift_swap', entityId: body.swap_id,
    afterValue: JSON.stringify({ swapped: true, approved_by: session.userId })
  });

  return ok({ swap_id: body.swap_id, status: 'APPROVED' });
});
