/**
 * Draft-SOP notice for the Operasional checklists. Mirrors the reference
 * "Preview - Draf SOP" framing: the tasks are examples until an official
 * per-brand SOP is attached.
 */
export function DraftSopBanner({ context }: { context?: string }) {
  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
      <span className="mr-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
        Draf SOP
      </span>
      {context ? <strong>Draf untuk {context}. </strong> : null}
      Daftar ini memakai contoh tugas yang disampaikan tim. SOP resmi tiap brand/outlet belum
      dilampirkan; sesuaikan dan validasi sebelum dipakai operasional.
    </div>
  );
}
