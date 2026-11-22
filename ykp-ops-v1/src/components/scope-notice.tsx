export function ScopeNotice({ role, outletId }: { role: string; outletId?: string }) {
  if (!['brand_manager', 'outlet_manager', 'supervisor', 'kitchen_lead', 'staff'].includes(role)) return null;
  if (outletId) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      Akun ini belum terhubung ke outlet, jadi data outlet tidak bisa ditampilkan. Minta admin mengisi outlet pada akun Anda.
    </div>
  );
}
