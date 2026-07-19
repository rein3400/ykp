/**
 * Shared constants for Operational V1 ΓÇö enums from the brief.
 */

export const DEPARTMENTS = ['KITCHEN', 'FOH', 'CASHIER', 'BAR', 'STORAGE', 'GENERAL'] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const CHECKLIST_ITEM_STATUSES = ['NOT_STARTED', 'OK', 'ISSUE', 'FAILED', 'WAIVED', 'REVIEWED'] as const;

export const INCIDENT_TYPES = [
  'CUSTOMER_COMPLAINT', 'FOOD_QUALITY', 'SERVICE_DELAY', 'CASH_DIFFERENCE',
  'EQUIPMENT_FAILURE', 'SAFETY', 'HYGIENE', 'STAFFING', 'STOCK_SHORTAGE',
  'SYSTEM_ERROR', 'OTHER'
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

// Status flow per V1 scope: OPEN ΓåÆ IN_PROGRESS ΓåÆ RESOLVED (+ OVERDUE detection by deadline)
export const INCIDENT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export const WASTE_TYPES = [
  'EXPIRED', 'SPOILED', 'OVERPRODUCTION', 'WRONG_ORDER', 'QC_REJECT',
  'SPILL', 'PORTION_ERROR', 'STORAGE_ERROR', 'MISSING', 'OTHER'
] as const;
export type WasteType = (typeof WASTE_TYPES)[number];

export const BRIEFING_TYPES = ['AUTO_AI', 'MANUAL', 'HYBRID'] as const;

export const SHIFTS = [
  { shift_id: 'SH-001', shift_name: 'Pagi', start_time: '07:00', end_time: '15:00' },
  { shift_id: 'SH-002', shift_name: 'Sore', start_time: '15:00', end_time: '23:00' }
] as const;

export function shiftName(shiftId: string): string {
  return SHIFTS.find((s) => s.shift_id === shiftId)?.shift_name ?? shiftId;
}
