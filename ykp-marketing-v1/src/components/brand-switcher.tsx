import { BRANDS } from '@/data/marketing-preview';

export function BrandSwitcher() {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Pilih brand">
      {BRANDS.map((brand) => (
        <span
          key={brand}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
        >
          {brand}
        </span>
      ))}
    </div>
  );
}
