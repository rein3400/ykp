/**
 * Human-readable shift labels. Sheet rows sometimes have brand IDs or empty
 * names in shift_name (mis-seeded master_shift). Never show raw BR-xxx alone.
 */

const KNOWN_SHIFT_NAMES: Record<string, string> = {
  'SH-001': 'Pagi',
  'SH-002': 'Siang',
  'SH-003': 'Split',
  'SH-004': 'Malam',
};

export type ShiftLike = {
  shift_id?: string;
  shift_name?: string;
  start_time?: string;
  end_time?: string;
  brand_id?: string;
  [key: string]: string | undefined;
};

function looksLikeBrandId(v: string): boolean {
  return /^BR-\d+/i.test(v.trim());
}

function looksLikeShiftId(v: string): boolean {
  return /^SH-\d+/i.test(v.trim());
}

function looksLikeTime(v: string): boolean {
  // 07:00, 7:00, 20:00 — not bare "60" or "30" break minutes
  return /^\d{1,2}:\d{2}$/.test(v.trim());
}

/**
 * Resolve a display label for a shift row or bare shift_id.
 */
export function shiftLabel(shift: ShiftLike | string | null | undefined): string {
  if (!shift) return '—';
  if (typeof shift === 'string') {
    const known = KNOWN_SHIFT_NAMES[shift];
    if (known) return known;
    if (looksLikeBrandId(shift)) return '—';
    return shift;
  }

  const id = (shift.shift_id || '').trim();
  const rawName = (shift.shift_name || '').trim();
  const start = (shift.start_time || '').trim();
  const end = (shift.end_time || '').trim();
  const timeWindow =
    looksLikeTime(start) && looksLikeTime(end) ? `${start}–${end}` : '';

  // Prefer real human name (not brand id, not empty, not just another id)
  if (rawName && !looksLikeBrandId(rawName) && !looksLikeShiftId(rawName)) {
    return timeWindow ? `${rawName} (${timeWindow})` : rawName;
  }

  // Known seeded ids
  if (id && KNOWN_SHIFT_NAMES[id]) {
    const name = KNOWN_SHIFT_NAMES[id];
    return timeWindow ? `${name} (${timeWindow})` : name;
  }

  // Time window alone is better than brand id
  if (timeWindow) return timeWindow;

  if (id && !looksLikeBrandId(id)) return id;
  return '—';
}
