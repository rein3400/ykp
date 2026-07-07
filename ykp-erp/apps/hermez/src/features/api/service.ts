/**
 * Hermez client service — fetch wrappers for /api/hermez/*.
 * All helpers return the unwrapped `data` payload or throw on error.
 */
import type {
  BriefResponse,
  AlertsResponse,
  ConfigResponse,
  RunResult,
  TelegramTestResult,
  AlertRow,
  ConfigRow,
  AlertStatus,
} from "./types";

async function parse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { data?: T; error?: { code: string; message: string } };
  if (!res.ok || !json.data) {
    const message = json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json.data;
}

export async function fetchBrief(date?: string): Promise<BriefResponse> {
  const url = "/api/hermez/brief" + (date ? `?date=${encodeURIComponent(date)}` : "");
  const res = await fetch(url);
  return parse<BriefResponse>(res);
}

export interface AlertFilters {
  date?: string;
  severity?: string;
  status?: string;
  alert_type?: string;
  outlet?: string;
}

export async function fetchAlerts(filters: AlertFilters = {}): Promise<AlertsResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  const url = "/api/hermez/alerts" + (params.toString() ? `?${params}` : "");
  const res = await fetch(url);
  return parse<AlertsResponse>(res);
}

export async function fetchConfig(): Promise<ConfigResponse> {
  const res = await fetch("/api/hermez/config");
  return parse<ConfigResponse>(res);
}

export async function updateConfig(key: string, value: string): Promise<ConfigRow> {
  const res = await fetch("/api/hermez/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  return parse<{ config: ConfigRow }>(res).then((d) => d.config);
}

export async function runBrief(date?: string): Promise<RunResult> {
  const res = await fetch("/api/hermez/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ date }),
  });
  return parse<RunResult>(res);
}

export async function sendTelegramTest(message: string): Promise<TelegramTestResult> {
  const res = await fetch("/api/hermez/telegram/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return parse<TelegramTestResult>(res);
}

export async function patchAlertStatus(
  id: string,
  status: AlertStatus,
  actionTaken: string,
): Promise<AlertRow> {
  const res = await fetch(`/api/hermez/alerts/${id}/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status, action_taken: actionTaken }),
  });
  return parse<{ alert: AlertRow }>(res).then((d) => d.alert);
}