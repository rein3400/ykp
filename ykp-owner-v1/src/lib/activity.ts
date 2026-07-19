/**
 * Owner activity feed: fetch every module's PUBLIC audit endpoint in
 * parallel, normalize the two on-sheet schema families
 * (user_id/record_type/created_at vs actor_user_id/entity/timestamp)
 * into one timeline. Per-module failure isolation, same as aggregate.
 */
import type { ModuleKey } from './types';
import { MODULE_KEYS } from './types';
import { MODULES, moduleUrl } from './modules';
import { fetchJson, extractItems } from './fetch';

export interface OwnerActivityItem {
  id: string;
  module: ModuleKey;
  moduleLabel: string;
  /** WIB timestamp (YYYY-MM-DD HH:mm:ss), '' when unknown. */
  time: string;
  user: string;
  role: string;
  action: string;
  recordType: string;
  recordId: string;
  reason: string;
  beforeValue: string;
  afterValue: string;
}

export interface ActivityFeed {
  items: OwnerActivityItem[];
  /** Modules whose audit endpoint failed — feed is partial. */
  unavailable: { key: ModuleKey; label: string }[];
}

function normalize(key: ModuleKey, label: string, row: Record<string, string>): OwnerActivityItem {
  return {
    id: row.audit_id ?? '',
    module: key,
    moduleLabel: label,
    time: row.created_at ?? row.timestamp ?? '',
    user: row.user_id ?? row.actor_user_id ?? '',
    role: row.actor_role ?? '',
    action: row.action ?? '',
    recordType: row.record_type ?? row.entity ?? '',
    recordId: row.record_id ?? row.entity_id ?? '',
    reason: row.reason ?? '',
    beforeValue: row.before_value ?? '',
    afterValue: row.after_value ?? ''
  };
}

export interface ActivityQuery {
  from?: string;
  to?: string;
  modules?: ModuleKey[];
  limitPerModule?: number;
}

export async function getActivityFeed(q: ActivityQuery = {}): Promise<ActivityFeed> {
  const keys = q.modules?.length ? q.modules : MODULE_KEYS;
  const limit = q.limitPerModule ?? 200;
  const results = await Promise.all(
    keys.map(async (key) => {
      const def = MODULES[key];
      const params = new URLSearchParams({ limit: String(limit) });
      if (q.from) params.set('from', q.from);
      if (q.to) params.set('to', q.to);
      const res = await fetchJson(`${moduleUrl(def, def.auditPath)}?${params.toString()}`);
      return { key, label: def.label, rows: res.ok ? extractItems(res.data) : null };
    })
  );
  const unavailable = results
    .filter((r) => r.rows === null)
    .map(({ key, label }) => ({ key, label }));
  const items = results.flatMap((r) => (r.rows ?? []).map((row) => normalize(r.key, r.label, row)));
  items.sort((a, b) => b.time.localeCompare(a.time));
  return { items, unavailable };
}
