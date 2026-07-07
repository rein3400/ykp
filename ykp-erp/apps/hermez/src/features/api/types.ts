/**
 * Hermez client API types. Mirrors the server envelope { data } / { error }.
 */

export type AlertLevel = "green" | "yellow" | "red";
export type AlertSeverity = "warning" | "critical";
export type AlertStatus = "open" | "ack" | "resolved";
export type AlertType =
  | "late_staff"
  | "cash_diff"
  | "supplier_overdue"
  | "petty_cash_anomaly"
  | "high_expense"
  | "schema_mismatch"
  | "data_missing";
export type SourceApp = "hr" | "finance" | "ops";

export interface BriefRow {
  briefId: string;
  date: string;
  alertLevel: AlertLevel;
  briefText: string;
  sentToOwner: boolean;
  sentAt: string | null;
  generatedAt: string | null;
}

export interface AlertRow {
  alertId: string;
  date: string;
  brand: string | null;
  outlet: string | null;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  sourceApp: SourceApp;
  status: AlertStatus;
  actionTaken: string;
  assignedTo: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
}

export interface ConfigRow {
  configId: string;
  key: string;
  value: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface RunResult {
  brief_id: string;
  date: string;
  alert_count: number;
  level: AlertLevel;
}

export interface TelegramTestResult {
  sent: boolean;
  error?: string;
  messageId?: number;
}

export interface BriefResponse {
  brief: BriefRow | null;
}

export interface AlertsResponse {
  items: AlertRow[];
  total: number;
}

export interface ConfigResponse {
  items: ConfigRow[];
}

export interface ApiError {
  error: { code: string; message: string };
}