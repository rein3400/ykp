/**
 * Deprecation banner shown on legacy F1–F5 pages (Review Cycle 2).
 * Legacy writes can also be hard-disabled server-side via
 * WAREHOUSE_LEGACY_WRITES_ENABLED=false (see src/lib/legacy.ts).
 */
export default function LegacyBanner({ newFlow }: { newFlow: string }) {
  return (
    <div className='rounded border border-warning bg-warning/10 px-3 py-2 text-xs text-foreground'>
      <span className='font-semibold'>Mode legacy</span> — halaman ini memakai alur lama (F-form) dan
      hanya disediakan untuk migrasi. Gunakan alur baru: <span className='font-medium'>{newFlow}</span>.
    </div>
  );
}
