"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function CategoryMasterEditor({
  categories,
}: {
  categories: Record<string, string>[];
}) {
  const [id, setId] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/finance/expense-category", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category_id: id, category_name: name }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Gagal");
      setId("");
      setName("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koneksi gagal");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded border p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        Edit Master Kategori Pengeluaran
      </summary>
      <p className="my-2 text-xs">
        Nama kategori yang sudah dipakai transaksi dikunci agar riwayat tidak
        berubah. Buat kategori baru melalui pengaturan/master data bila
        diperlukan.
      </p>
      <label className="text-xs">
        Kategori
        <select
          className="block w-full rounded border p-2"
          disabled={busy}
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setName(
              categories.find((c) => c.category_id === e.target.value)
                ?.category_name ?? "",
            );
          }}
        >
          <option value="">Pilih kategori</option>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>
              {c.category_name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Nama yang benar
        <input
          className="block w-full rounded border p-2"
          disabled={busy}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        disabled={busy || !id || !name.trim()}
        onClick={save}
        className="mt-2 rounded border px-3 py-2 text-xs"
      >
        Simpan Nama Kategori
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </details>
  );
}
