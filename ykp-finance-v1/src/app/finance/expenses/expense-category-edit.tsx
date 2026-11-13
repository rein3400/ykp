"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ExpenseCategoryEdit({
  id,
  current,
  categories,
}: {
  id: string;
  current: string;
  categories: Record<string, string>[];
}) {
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(current),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/finance/expenses/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expense_category: value, reason }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Gagal");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koneksi gagal");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="text-xs underline"
        onClick={() => setOpen(!open)}
      >
        Edit kategori
      </button>
      {open && (
        <div className="space-y-2 rounded border p-2">
          <label className="text-xs">
            Kategori
            <select
              className="block w-full rounded border p-2"
              disabled={busy}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
              <option value={current}>{current}</option>
              {categories
                .filter(
                  (c) => c.category_name !== current && c.status === "active",
                )
                .map((c) => (
                  <option key={c.category_id} value={c.category_name}>
                    {c.category_name}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-xs">
            Alasan koreksi
            <input
              disabled={busy}
              className="block w-full rounded border p-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            disabled={busy || !reason.trim() || value === current}
            onClick={save}
          >
            Simpan kategori
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </>
  );
}
