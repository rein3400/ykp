/**
 * Audit log writer. Every mutation writes one row to system_audit_log sheet.
 * Expanded per brief §30: module, record_type, approval_user_id, environment.
 * auditId: `AUD-<ts36>-<randHex>` (race-free across processes/restarts).
 *
 * Tamper-evidence (P0 fraud control): each row carries `chain_hash` =
 * sha256(prev_row_chain_hash + canonical(row fields)). Rows form a hash
 * chain — editing/deleting/reordering any historical row breaks every
 * subsequent hash. Verify nightly via verifyAuditChain() (see
 * scripts or GET /api/warehouse/audit?verify=1).
 *
 * Rows written before this feature shipped have empty chain_hash;
 * verification starts at the first chained row.
 */
import { randomBytes, createHash } from 'crypto';
import { appendRows, readTab, TABS } from '@/db/sheets';
import { nowTimestampWib } from './format';

export interface AuditEntry {
  module: string;
  action: string;
  recordType: string;
  recordId: string;
  beforeValue?: string;
  afterValue?: string;
  reason?: string;
  userId: string;
  approvalUserId?: string;
  environment?: string;
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
    'audit_id', 'module', 'action', 'record_type', 'record_id',
    'before_value', 'after_value', 'reason', 'user_id', 'approval_user_id',
    'environment', 'ip_address', 'created_at'
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
    module: entry.module,
    action: entry.action,
    record_type: entry.recordType,
    record_id: entry.recordId,
    before_value: entry.beforeValue ?? '',
    after_value: entry.afterValue ?? '',
    reason: entry.reason ?? '',
    user_id: entry.userId,
    approval_user_id: entry.approvalUserId ?? '',
    environment: entry.environment ?? process.env.ENVIRONMENT ?? 'TESTING',
    ip_address: entry.ipAddress ?? '',
    created_at: nowTimestampWib()
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
