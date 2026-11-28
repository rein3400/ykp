import { META_GUIDE_ITEMS, DISCLAIMERS } from '@/data/marketing-preview';

export function MetaGuide() {
  return (
    <section
      aria-labelledby="panduan-meta"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="panduan-meta" className="text-lg font-bold text-ink">
            Panduan Meta
          </h2>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Ada perubahan
          </span>
        </div>
        <button
          type="button"
          disabled
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-400"
        >
          Refresh panduan
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Mulai dari panduan yang jelas. Centang yang sudah ditinjau, lalu pilih ide untuk diproduksi.
      </p>
      <p className="mt-1 text-xs text-amber-700">{DISCLAIMERS.meta}</p>

      <ul className="mt-4 space-y-3">
        {META_GUIDE_ITEMS.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-100 p-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                defaultChecked={item.done}
                readOnly
                className="mt-0.5 h-4 w-4 accent-[#E01020]"
              />
              <span>
                <span className="text-sm font-semibold text-slate-800">{item.title}</span>
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                  {item.source}
                </span>
                <span className="mt-1 block text-xs text-slate-600">{item.body}</span>
                <span className="mt-1 block text-[10px] text-slate-400">{item.version}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
