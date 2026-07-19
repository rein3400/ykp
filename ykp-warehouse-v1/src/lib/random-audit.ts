/**
 * Random audit (audit mendadak) target picker — anti-fraud blueprint §Layer 2.
 *
 * Owner KPI (Dashboard sheet): "Jumlah audit mendadak ≥ 1× per minggu".
 * Unpredictability is the deterrent: targets are chosen randomly per week,
 * weighted toward CRITICAL items (highest value / most-leaked per owner SOP).
 *
 * Pure function — inject rng for deterministic tests.
 */
export interface AuditItem {
  item_id: string;
  item_name?: string;
  criticality?: string;
  active_status?: string;
}

export interface AuditTarget {
  item_id: string;
  item_name: string;
  criticality: string;
}

/**
 * Pick n distinct audit targets. CRITICAL items are always eligible;
 * if there aren't enough, pad with STANDARD items (shuffled).
 */
export function pickAuditTargets(items: AuditItem[], n: number, rng: () => number = Math.random): AuditTarget[] {
  const active = items.filter((i) => (i.active_status ?? 'active') === 'active');
  const critical = active.filter((i) => (i.criticality ?? '').toUpperCase() === 'CRITICAL');
  const standard = active.filter((i) => (i.criticality ?? '').toUpperCase() !== 'CRITICAL');

  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const picked = [...shuffle(critical), ...shuffle(standard)].slice(0, Math.max(0, n));
  return picked.map((i) => ({
    item_id: i.item_id,
    item_name: i.item_name ?? i.item_id,
    criticality: (i.criticality ?? 'STANDARD').toUpperCase()
  }));
}

/** ISO week tag (e.g. 2026-W29) for weekly idempotency. */
export function isoWeekTag(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
