'use client';
import { BRANDS } from '@/data/marketing-preview';
import { ALL_BRANDS } from '@/lib/marketing-state';

export function BrandSwitcher({
  selected,
  onSelect
}: {
  selected: string;
  onSelect: (brand: string) => void;
}) {
  const options = [ALL_BRANDS, ...BRANDS];
  return (
    <div className="flex flex-wrap gap-2" aria-label="Pilih brand">
      {options.map((brand) => {
        const active = brand === selected;
        return (
          <button
            key={brand}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(brand)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              active
                ? 'border-[#E01020] bg-[#E01020] text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-red-200'
            }`}
          >
            {brand}
          </button>
        );
      })}
    </div>
  );
}
