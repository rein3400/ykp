/**
 * Hermez alert log writer per brief §11.
 *
 * Generates HermesAlert rows from the daily summary + raw inputs. Alert IDs
 * are deterministic (HAL-{date}-{outlet}-{type}-{sha1(message).slice(0,6)})
 * so re-running summary regenerate is idempotent — caller should upsert
 * (find existing by alert_id, update if present, append otherwise).
 *
 * Brief §11 rule set implemented:
 *   staff_late > 2                  → MEDIUM (alert_type LATE_THRESHOLD)
 *   staff_absent tanpa keterangan    → HIGH   (ABSENT)
 *   incomplete attendance > 1       → MEDIUM (INCOMPLETE)
 *   shift shortage                  → HIGH   (SHIFT_SHORTAGE)
 *   payroll belum approved (PENDING)→ HIGH   (PAYROLL_PENDING)
 */

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface HermesAlert {
  alert_id: string;
  date: string;
  brand: string;
  outlet: string;
  source_app: string;
  alert_type: string;
  severity: AlertSeverity;
  message: string;
  status: 'OPEN' | 'ACK' | 'RESOLVED';
  assigned_to: string;
  action_taken: string;
  created_at: string;
  resolved_at: string;
}

export interface AlertInput {
  date: string;
  brand_name: string;
  outlet_id: string;
  outlet_name: string;
  staff_late: number;
  staff_absent: number;
  staff_leave: number;
  staff_present: number;
  incomplete_attendance: number;
  shift_shortage: number;
  total_late_minutes: number;
  payroll_pending_count: number;
  has_inactive_in_roster: boolean;
}

/** Deterministic alert_id so regen is idempotent. */
function alertId(date: string, outlet: string, type: string, msg: string): string {
  // Simple hash: sum char codes + length. Good enough for 5-10 outlets, no
  // need for crypto here since uniqueness only matters within a (date,outlet,type).
  let h = 0;
  for (let i = 0; i < msg.length; i++) {
    h = (h * 31 + msg.charCodeAt(i)) | 0;
  }
  const hash = (h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  return `HAL-${date.replace(/-/g, '')}-${outlet}-${type}-${hash}`;
}

export function generateAlerts(input: AlertInput, now: string): HermesAlert[] {
  const alerts: HermesAlert[] = [];
  const base = {
    date: input.date,
    brand: input.brand_name,
    outlet: input.outlet_id,
    source_app: 'hr-v1'
  } as const;

  const push = (
    type: string,
    severity: AlertSeverity,
    message: string
  ): void => {
    alerts.push({
      ...base,
      alert_id: alertId(input.date, input.outlet_id, type, message),
      alert_type: type,
      severity,
      message,
      status: 'OPEN',
      assigned_to: '',
      action_taken: '',
      created_at: now,
      resolved_at: ''
    });
  };

  if (input.staff_late > 2) {
    push('LATE_THRESHOLD', 'MEDIUM', `${input.staff_late} staff telat di ${input.outlet_name}`);
  }
  if (input.staff_absent > 0) {
    push('ABSENT', 'HIGH', `${input.staff_absent} staff absen tanpa keterangan di ${input.outlet_name}`);
  }
  if (input.incomplete_attendance > 1) {
    push('INCOMPLETE', 'MEDIUM', `${input.incomplete_attendance} staff belum checkout di ${input.outlet_name}`);
  }
  if (input.shift_shortage > 0) {
    push('SHIFT_SHORTAGE', 'HIGH', `Shift shortage ${input.shift_shortage} di ${input.outlet_name}`);
  }
  if (input.payroll_pending_count > 0) {
    push(
      'PAYROLL_PENDING',
      'HIGH',
      `${input.payroll_pending_count} payroll masih PENDING di ${input.outlet_name}`
    );
  }
  if (input.has_inactive_in_roster) {
    push(
      'INACTIVE_IN_ROSTER',
      'MEDIUM',
      `Akun staff tidak aktif namun masuk roster di ${input.outlet_name}`
    );
  }

  return alerts;
}