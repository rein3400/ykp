import { randomBytes, createHash } from 'crypto';
import { appendRows, readTab, TABS } from '@/db/sheets';
import { nowTimestampWib } from './format';

export interface AuditEntry {
  actorUserId: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string;
  beforeValue?: string;
  afterValue?: string;
  reason?: string;
  ipAddress?: string;
}

export function auditId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(5).toString('hex').toUpperCase();
  return `AUD-${ts}-${rand}`;
}

/** Canonical serialization for hashing — stable field order, no timestamps. */
function canonicalRow(row: Record<string, string>): string {
  const keys = [
    'audit_id', 'timestamp', 'actor_user_id', 'actor_role', 'action',
    'entity', 'entity_id', 'before_value', 'after_value', 'reason', 'ip_address',
  ];
  return keys.map((k) => `${k}=${row[k] ?? ''}`).join('|');
}

export function computeChainHash(prevHash: string, row: Record<string, string>): string {
  return createHash('sha256').update(`${prevHash}::${canonicalRow(row)}`).digest('hex');
}

const GENESIS = 'GENESIS';

async function lastChainHash(): Promise<string> {
  try {
    const rows = await readTab<Record<string, string>>(TABS.auditLog);
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].chain_hash) return rows[i].chain_hash;
    }
  } catch (e) {
    console.error('[audit] failed to read last chain hash:', e);
  }
  return GENESIS;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const row: Record<string, string> = {
    audit_id: auditId(),
    timestamp: nowTimestampWib(),
    actor_user_id: entry.actorUserId,
    actor_role: entry.actorRole,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId,
    before_value: entry.beforeValue ?? '',
    after_value: entry.afterValue ?? '',
    reason: entry.reason ?? '',
    ip_address: entry.ipAddress ?? '',
  };
  try {
    const prev = await lastChainHash();
    row.chain_hash = computeChainHash(prev, row);
    await appendRows(TABS.auditLog, [row]);
  } catch (e) {
    console.error('[audit] failed to write audit log:', e);
  }
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  firstChainedIndex: number;
  brokenAt?: { index: number; auditId: string };
  skippedLegacy: number;
}

/**
 * Verify the audit hash chain end-to-end. O(n) single pass.
 * Rows with empty chain_hash (pre-feature legacy) are skipped but counted.
 */
export async function verifyAuditChain(): Promise<ChainVerification> {
  const rows = await readTab<Record<string, string>>(TABS.auditLog);
  let prev = GENESIS;
  let checked = 0;
  let skippedLegacy = 0;
  let firstChainedIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.chain_hash) {
      skippedLegacy++;
      continue;
    }
    if (firstChainedIndex === -1) firstChainedIndex = i;
    const expect = computeChainHash(prev, r);
    if (expect !== r.chain_hash) {
      return { ok: false, checked, firstChainedIndex, brokenAt: { index: i, auditId: r.audit_id }, skippedLegacy };
    }
    prev = r.chain_hash;
    checked++;
  }
  return { ok: true, checked, firstChainedIndex, skippedLegacy };
}
