/**
 * POST /api/warehouse/cron/random-audit
 * Protected by CRON_SECRET (x-cron-secret / Authorization: Bearer).
 *
 * Weekly scheduler (recommend: Senin 08:00 WIB) — implements owner KPI
 * "audit mendadak ≥ 1× per minggu". Picks random CRITICAL-weighted items,
 * creates audit-mendadak actions in the action tracker, pushes a Telegram
 * notification for HIGH priority.
 *
 * Idempotent per ISO week: re-running within the same week returns
 * SKIPPED_EXISTING instead of duplicating actions.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { ok, unauthorized, handler } from '@/lib/http';
import { isCronAuthorized } from '@/lib/cron';
import { nextSequentialIdSync } from '@/lib/repo';
import { nowTimestampWib, formatDateWib } from '@/lib/format';
import { pickAuditTargets, isoWeekTag, type AuditItem } from '@/lib/random-audit';
import { logAudit } from '@/lib/audit';
import { pushAlertNotification } from '@/lib/telegram';

const TARGETS_PER_WEEK = 3;
const ACTION_TAG = 'AUDIT-MENDADAK';

export const POST = handler(async (req: NextRequest) => {
  if (!isCronAuthorized(req)) return unauthorized('Invalid or missing CRON_SECRET');

  const now = new Date();
  const weekTag = isoWeekTag(now);
  const today = formatDateWib(now);
  // Due end of this week (today + 3 days gives staff time to recount)
  const due = new Date(now);
  due.setDate(due.getDate() + 3);
  const dueDate = formatDateWib(due);

  // Weekly idempotency: an action tagged with this week already exists?
  const actions = await readTab<Record<string, string>>(TABS.actionTracker);
  const existing = actions.find(
    (a) => (a.title ?? '').includes(ACTION_TAG) && (a.title ?? '').includes(weekTag)
  );
  if (existing) {
    return ok({ status: 'SKIPPED_EXISTING', week: weekTag, action_id: existing.action_id });
  }

  const items = await readTab<AuditItem & Record<string, string>>(TABS.items);
  const targets = pickAuditTargets(items, TARGETS_PER_WEEK);
  if (targets.length === 0) return ok({ status: 'SKIPPED', reason: 'no active items' });

  const nowTs = nowTimestampWib();
  const created: string[] = [];
  for (const t of targets) {
    const actionId = nextSequentialIdSync('ACT');
    await appendRows(TABS.actionTracker, [{
      action_id: actionId,
      source_alert_id: '',
      title: `${ACTION_TAG} ${weekTag}: recount ${t.item_name}`,
      description:
        `Audit mendadak minggu ${weekTag}. Hitung fisik ${t.item_name} (${t.item_id}), ` +
        'cocokkan dengan book stock di ledger. Selisih > toleransi = investigasi + laporkan ke owner.',
      brand_id: '',
      outlet_id: '',
      location_id: '',
      item_id: t.item_id,
      priority: t.criticality === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
      assigned_to: '',
      assigned_role: 'supervisor',
      due_date: dueDate,
      status: 'OPEN',
      action_taken: '',
      attachment_url: '',
      approved_by: '',
      created_at: nowTs,
      updated_at: nowTs,
      completed_at: ''
    }]);
    created.push(actionId);
  }

  await logAudit({
    module: 'warehouse', action: 'generate', recordType: 'random_audit',
    recordId: weekTag, afterValue: JSON.stringify({ targets: created }),
    userId: 'cron'
  }).catch(() => null);

  // One Telegram push per weekly batch (HIGH priority = CRITICAL items included).
  const hasCritical = targets.some((t) => t.criticality === 'CRITICAL');
  await pushAlertNotification('warehouse', {
    alertId: created[0],
    severity: hasCritical ? 'HIGH' : 'MEDIUM',
    title: `Audit mendadak ${weekTag}: ${targets.length} item`,
    message: targets.map((t) => `• ${t.item_name}`).join('\n'),
    date: today
  });

  return ok({ status: 'CREATED', week: weekTag, due_date: dueDate, targets, action_ids: created });
});
