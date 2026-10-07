export function selectChecklistTemplates(
  templates: Record<string, string>[], type: string, outletId: string, brandId: string
): Record<string, string>[] {
  return templates.filter((template) =>
    template.checklist_type?.toUpperCase() === type &&
    ['active', '1'].includes((template.active_status ?? '').trim().toLowerCase()) &&
    (!template.outlet_id || template.outlet_id === outletId) &&
    (!template.brand_id || template.brand_id === brandId)
  );
}

export function validateChecklistSubmission(
  templates: Record<string, string>[], items: Record<string, string>[]
): { status: 'CLOSED' | 'NEEDS_REVIEW'; items: Record<string, string>[] } {
  if (!templates.length || items.length !== templates.length) throw new Error('Checklist tidak lengkap atau template tidak tersedia');
  const names = new Set<string>();
  const validated = items.map((item) => {
    if (names.has(item.checklist_item)) throw new Error('Item checklist duplikat');
    names.add(item.checklist_item);
    const template = templates.find((candidate) => candidate.checklist_item === item.checklist_item);
    if (!template || !['DONE', 'NOT_DONE'].includes(item.status)) throw new Error('Item atau status checklist tidak valid');
    if ((item.notes !== undefined && typeof item.notes !== 'string') || (item.photo_url !== undefined && typeof item.photo_url !== 'string')) throw new Error('Catatan dan foto harus berupa teks');
    if (item.status === 'DONE' && template.required_photo === 'true') {
      let url: URL;
      try { url = new URL(item.photo_url); } catch { throw new Error('Foto wajib untuk item ini'); }
      if (url.protocol !== 'https:') throw new Error('Foto wajib menggunakan HTTPS');
    }
    return {
      checklist_item: template.checklist_item, department: template.department ?? 'Umum',
      critical_flag: template.critical_flag ?? 'false', status: item.status,
      notes: item.notes ?? '', photo_url: item.photo_url ?? ''
    };
  });
  return { status: validated.some((item) => item.status !== 'DONE') ? 'NEEDS_REVIEW' : 'CLOSED', items: validated };
}
