'use client';
import { useState } from 'react';

export default function AlertsClient({
  alerts,
}: {
  alerts: Record<string, string>[];
  items: Record<string, string>[];
}) {
  const [filter, setFilter] = useState({ severity: '', status: '' });
  const [list, setList] = useState(alerts);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = list
    .filter((a) => {
      if (filter.severity && a.severity !== filter.severity) return false;
      if (filter.status && a.status !== filter.status) return false;
      return true;
    })
    .sort((a, b) => (b.alert_datetime || '').localeCompare(a.alert_datetime || ''));

  async function reload() {
    const r = await fetch('/api/warehouse/alerts', { credentials: 'include' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message ?? `HTTP ${r.status}`);
    if (j.data?.items) setList(j.data.items);
  }

  async function updateStatus(alertId: string, action: string) {
    setErr(null);
    setBusyId(alertId);
    try {
      const r = await fetch('/api/warehouse/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ alert_id: alertId, action }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message ?? `HTTP ${r.status}`);
      // Prefer server-returned row for instant feedback, then reconcile list.
      if (j.data?.alert_id) {
        setList((prev) => prev.map((a) => (a.alert_id === alertId ? { ...a, ...j.data } : a)));
      }
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-xs">
        <select
          aria-label="Filter by severity"
          value={filter.severity}
          onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
          className="rounded border border-border px-2 py-1"
        >
          <option value="">All Severity</option>
          {['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="rounded border border-border px-2 py-1"
        >
          <option value="">All Status</option>
          {['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'IGNORED'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {err && <p className="text-xs text-destructive" role="alert">{err}</p>}
      <div className="space-y-2">
        {filtered.map((a) => (
          <div
            key={a.alert_id}
            className={`rounded border p-3 text-xs ${
              a.severity === 'CRITICAL'
                ? 'border-red-400 bg-red-50'
                : a.severity === 'HIGH'
                  ? 'border-orange-300 bg-orange-50'
                  : a.severity === 'MEDIUM'
                    ? 'border-yellow-300 bg-yellow-50'
                    : 'border-border bg-background'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{a.alert_type?.replace(/_/g, ' ')}</span>
                <span
                  className={`ml-2 rounded px-1 text-[10px] font-medium ${
                    a.severity === 'CRITICAL'
                      ? 'bg-red-200 text-red-900'
                      : a.severity === 'HIGH'
                        ? 'bg-orange-200 text-orange-900'
                        : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {a.severity}
                </span>
                <span className="ml-2 text-muted-foreground">{a.alert_datetime}</span>
              </div>
              <div className="flex gap-1">
                {a.status === 'OPEN' && (
                  <>
                    <button
                      type="button"
                      disabled={busyId === a.alert_id}
                      onClick={() => updateStatus(a.alert_id, 'acknowledge')}
                      className="rounded bg-blue-700 px-2 py-0.5 text-[10px] text-white disabled:opacity-50"
                    >
                      ACK
                    </button>
                    <button
                      type="button"
                      disabled={busyId === a.alert_id}
                      onClick={() => updateStatus(a.alert_id, 'resolve')}
                      className="rounded bg-green-700 px-2 py-0.5 text-[10px] text-white disabled:opacity-50"
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === a.alert_id}
                      onClick={() => updateStatus(a.alert_id, 'ignore')}
                      className="rounded bg-gray-600 px-2 py-0.5 text-[10px] text-white disabled:opacity-50"
                    >
                      Ignore
                    </button>
                  </>
                )}
                {a.status !== 'OPEN' && <span className="text-muted-foreground">{a.status}</span>}
              </div>
            </div>
            <p className="mt-1 font-medium">{a.title}</p>
            <p className="text-muted-foreground">{a.message}</p>
            {a.action_required && (
              <p className="mt-1 font-medium text-primary">Action: {a.action_required}</p>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-4 text-center text-muted-foreground">
            No alerts. System akan generate otomatis dari transaksi.
          </p>
        )}
      </div>
    </div>
  );
}
