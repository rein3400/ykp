/** Banner shown whenever data comes from the built-in mock dataset. */
export function MockBanner({ forced }: { forced: boolean }) {
  return (
    <div className='rounded-lg border border-gray-400 bg-gray-200 p-3 text-xs text-gray-800'>
      <strong>MODE MOCK aktif</strong> —{' '}
      {forced
        ? 'YKP_OWNER_MOCK=true, semua data adalah data demo bawaan.'
        : 'Semua modul tidak bisa dihubungi, dashboard menampilkan data demo bawaan.'}{' '}
      Login demo: owner / owner123.
    </div>
  );
}

/** Banner for partial degradation (some modules offline). */
export function DegradedBanner({ offline }: { offline: string[] }) {
  if (offline.length === 0) return null;
  return (
    <div className='rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800'>
      <strong>Sebagian data tidak tersedia</strong> — modul offline: {offline.join(', ')}.
      Tile lain tetap live.
    </div>
  );
}
