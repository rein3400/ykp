"use client";
import { useState } from "react";
import { SearchableSelect } from './searchable-select';
import { MASTER_ACTIONS, type MasterKind } from "@/lib/master-actions";
export function MasterActions({
  kind,
  rows,
  canEdit,
  canArchive,
}: {
  kind: MasterKind;
  rows: Record<string, string>[];
  canEdit: boolean;
  canArchive: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  if (!canEdit && !canArchive) return null;
  const rule = MASTER_ACTIONS[kind];
  const row = rows.find((r) => r[rule.key] === selected);
  async function submit(archive: boolean) {
    if (!row) return;
    if (
      archive &&
      !window.confirm(
        "Arsipkan master ini? Tidak menghapus riwayat. Operasi ditolak jika ada referensi yang belum aman.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/warehouse/masters/${kind}/${encodeURIComponent(selected)}`,
        {
          method: archive ? "DELETE" : "PUT",
          headers: { "content-type": "application/json" },
          body: archive ? undefined : JSON.stringify(draft),
        },
      );
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error?.message ?? "Gagal menyimpan");
      setNotice(
        archive
          ? "Master diarsipkan; riwayat tetap tersimpan."
          : "Perubahan tersimpan.",
      );
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koneksi gagal");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h2 className="text-sm font-semibold">Edit &amp; Arsipkan Master</h2>
      <p className="text-xs text-muted-foreground">
        ID, satuan/konversi dan cakupan master dikunci agar riwayat tidak
        berubah. Pengarsipan bukan penghapusan permanen.
      </p>
      <div className="block text-sm">
        <label htmlFor={`master-${kind}`}>Pilih master</label>
        <SearchableSelect id={`master-${kind}`} searchLabel='master nama atau kode'
          disabled={busy}
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            const r = rows.find((x) => x[rule.key] === e.target.value);
            setDraft(
              Object.fromEntries(rule.fields.map((f) => [f, r?.[f] ?? ""])),
            );
            setError("");
            setNotice("");
          }}
          className="mt-1 w-full rounded border p-2"
        >
          <option value="">Pilih item untuk Edit / Arsipkan</option>
          {rows.map((r) => (
            <option key={r[rule.key]} value={r[rule.key]}>
              {r.item_name ||
                r.supplier_name ||
                r.category_name ||
                r.location_name ||
                r[rule.key]}{" "}
              · {r[rule.key]}
              {r.active_status === "inactive" ? " (diarsipkan)" : ""}
            </option>
          ))}
        </SearchableSelect>
      </div>
      {row && (
        <>
          <p className="text-xs">Status: {row.active_status || "—"}</p>
          {canEdit && rule.fields.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {rule.fields.map((field) => (
                <label key={field} className="text-xs">
                  {field.replaceAll("_", " ")}
                  <input
                    disabled={busy || row.active_status === "inactive"}
                    value={draft[field] ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, [field]: e.target.value })
                    }
                    className="mt-1 w-full rounded border p-2 text-sm"
                  />
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            {canEdit && rule.fields.length > 0 && (
              <button
                disabled={busy || row.active_status === "inactive"}
                onClick={() => submit(false)}
                className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Menyimpan…" : "Simpan Edit"}
              </button>
            )}
            {canArchive && (
              <button
                disabled={busy || row.active_status === "inactive"}
                onClick={() => submit(true)}
                className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
              >
                Arsipkan
              </button>
            )}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-700">
          {notice}
        </p>
      )}
    </section>
  );
}
