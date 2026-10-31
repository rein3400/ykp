import { createHash } from 'node:crypto';
export function materialItem(brandId: string, rawName: string, rawWeight: string, rawUnit: string): Record<string, string> {
  const name = rawName.trim().replace(/\s+/g, ' ');
  const weight = Number(rawWeight.trim());
  const unit = rawUnit.trim().toLowerCase();
  if (!brandId || !name || !Number.isFinite(weight) || weight <= 0 || !['gr', 'g', 'ml', 'pc', 'pax'].includes(unit)) throw new Error('Nama, berat atau satuan bahan tidak lengkap/valid');
  const base = unit === 'gr' ? 'g' : unit;
  const id = createHash('sha256').update(JSON.stringify([brandId, name.toLowerCase(), weight, base])).digest('hex').slice(0, 20);
  return { item_id: `ITM-CSV-${id}`, item_code: `CSV-${id}`, item_name: `${name} (${weight} ${base})`, brand_id: brandId, item_type: 'RAW_MATERIAL', base_unit: base,
    purchase_unit: ['g', 'ml'].includes(base) ? 'pack' : base, conversion_factor: String(weight), pack_size: String(weight), active_status: 'active' };
}
