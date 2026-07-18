'use client';
import { useMemo, useState } from 'react';

export default function PurchaseReqClient({
  requests,
  recommendations,
}: {
  requests: Record<string, string>[];
  recommendations: Record<string, string>[];
}) {
  const [list, setList] = useState(requests);
  const [recs, setRecs] = useState(recommendations);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const newRecs = useMemo(
    () =>
      recs.filter(
        (r) =>
          (r.recommendation_status || '').toUpperCase() === 'NEW' &&
          (r.priority === 'CRITICAL' || r.priority === 'HIGH')
      ),
    [recs]
  );

  async function reloadRequests() {
    const r = await fetch('/api/warehouse/purchase-request', { credentials: 'include' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message ?? `HTTP ${r.status}`);
    // list() → { data: { items, total_items } }
    if (Array.isArray(j.data?.items)) setList(j.data.items);
    else if (Array.isArray(j.data)) setList(j.data);
  }

  async function reloadRecs() {
    const r = await fetch('/api/warehouse/purchase-recommendation', { credentials: 'include' });
    const j = await r.json();
    if (!r.ok) return;
    if (Array.isArray(j.data?.items)) setRecs(j.data.items);
    else if (Array.isArray(j.data?.recommendations)) setRecs(j.data.recommendations);
    else if (Array.isArray(j.data)) setRecs(j.data);
  }

  async function createFromRecs() {
    setErr(null);
    if (newRecs.length === 0) {
      setErr('Tidak ada CRITICAL/HIGH recommendation berstatus NEW');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/warehouse/purchase-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recommendation_ids: newRecs.map((rec) => rec.recommendation_id),
          priority: 'HIGH',
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message ?? `HTTP ${r.status}`);
      // API: ok({ header, items }) → j.data.header
      const header = j.data?.header ?? j.data;
      if (header?.purchase_request_id) {
        setList((prev) => [header, ...prev.filter((h) => h.purchase_request_id !== header.purchase_request_id)]);
      }
      await Promise.all([reloadRequests(), reloadRecs()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doAction(prId: string, action: string) {
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch('/api/warehouse/purchase-request', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ purchase_request_id: prId, action }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message ?? `HTTP ${r.status}`);
      if (j.data?.purchase_request_id) {
        setList((prev) => prev.map((h) => (h.purchase_request_id === prId ? j.data : h)));
      }
      await reloadRequests();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={createFromRecs}
        disabled={busy || newRecs.length === 0}
        className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? 'Memproses…' : `Buat PR dari ${newRecs.length} CRITICAL/HIGH Rec`}
      </button>
      {err && (
        <p className="text-xs text-destructive" role="alert">
          {err}
        </p>
      )}
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-2 py-1 text-left">ID</th>
              <th className="px-2 py-1 text-left">Tanggal</th>
              <th className="px-2 py-1 text-left">Priority</th>
              <th className="px-2 py-1 text-right">Est. Value</th>
              <th className="px-2 py-1 text-left">Status</th>
              <th className="px-2 py-1 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.purchase_request_id} className="border-t border-border">
                <td className="px-2 py-1 font-mono text-[10px]">{h.purchase_request_id}</td>
                <td className="px-2 py-1">{h.date}</td>
                <td className="px-2 py-1">{h.priority}</td>
                <td className="px-2 py-1 text-right">{formatRp(h.estimated_total_value)}</td>
                <td className="px-2 py-1">
                  <span
                    className={`rounded px-1 text-[10px] font-medium ${
                      h.status === 'APPROVED' || h.status === 'ORDERED'
                        ? 'bg-green-100 text-green-800'
                        : h.status === 'REJECTED' || h.status === 'CANCELLED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {h.status}
                  </span>
                </td>
                <td className="px-2 py-1">
                  <div className="flex gap-1">
                    {h.status === 'SUBMITTED' && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => doAction(h.purchase_request_id, 'approve')}
                          className="rounded bg-green-500 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => doAction(h.purchase_request_id, 'reject')}
                          className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {h.status === 'APPROVED' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => doAction(h.purchase_request_id, 'order')}
                        className="rounded bg-blue-500 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-50"
                      >
                        Order
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-3 text-center text-muted-foreground">
                  Belum ada purchase request.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatRp(n: string) {
  const v = Number(n || 0);
  if (!v) return '-';
  return new Intl.NumberFormat('id-ID').format(v);
}
