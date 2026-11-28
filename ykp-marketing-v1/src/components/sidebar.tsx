const MENU: Array<{ label: string; href: string; soon?: boolean }> = [
  { label: 'Dashboard Marketing', href: '/marketing' },
  { label: 'Ngobrol Konten', href: '#', soon: true },
  { label: 'Arahan Konten', href: '/marketing#arahan-konten' },
  { label: 'Content Planner', href: '#', soon: true },
  { label: 'Tugas Konten', href: '#', soon: true },
  { label: 'Publikasi', href: '#', soon: true },
  { label: 'Performa & Hasil', href: '#', soon: true },
  { label: 'Pengaturan', href: '#', soon: true },
  { label: 'Log Aktivitas', href: '#', soon: true }
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-4 font-bold text-ink">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E01020]" aria-hidden="true" />
        YKP <span className="text-[#E01020]">Marketing</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {MENU.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-red-50"
          >
            <span>{item.label}</span>
            {item.soon && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">segera</span>
            )}
          </a>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-4 text-[11px] text-slate-500">
        <div className="font-medium text-slate-800">PT YKP Global Utama</div>
        Ruang kerja tim YKP
      </div>
    </aside>
  );
}
