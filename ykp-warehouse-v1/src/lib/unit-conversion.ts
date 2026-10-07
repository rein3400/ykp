const aliases: Record<string, string> = {
  kg: 'kg', kilogram: 'kg', g: 'g', gr: 'g', gram: 'g',
  l: 'l', liter: 'l', litre: 'l', ml: 'ml', milliliter: 'ml', mililiter: 'ml'
};

export function normalizeUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  return aliases[normalized] ?? normalized;
}

export function fixedConversionFactor(from: string, to: string): number | null {
  const source = normalizeUnit(from);
  const target = normalizeUnit(to);
  const scales: Record<string, { dimension: string; scale: number }> = {
    kg: { dimension: 'mass', scale: 1000 }, g: { dimension: 'mass', scale: 1 },
    l: { dimension: 'volume', scale: 1000 }, ml: { dimension: 'volume', scale: 1 }
  };
  const a = scales[source];
  const b = scales[target];
  return a && b && a.dimension === b.dimension ? a.scale / b.scale : null;
}

export function validateConversionFactor(from: string, to: string, value: unknown): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || (typeof value === 'string' && !value.trim())) {
    throw new Error('Faktor konversi wajib berupa angka positif');
  }
  const factor = Number(value);
  if (!Number.isFinite(factor) || factor <= 0) throw new Error('Faktor konversi wajib berupa angka positif dan finite');
  const fixed = fixedConversionFactor(from, to);
  if (fixed !== null && factor !== fixed) throw new Error(`Faktor konversi satuan baku harus ${fixed}`);
  return factor;
}
