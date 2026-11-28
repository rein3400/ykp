import { Sidebar } from './sidebar';
import { BrandSwitcher } from './brand-switcher';
import { MetaGuide } from './meta-guide';
import { ContentReferenceCard } from './content-reference';
import { CONTENT_REFERENCES, DISCLAIMERS } from '@/data/marketing-preview';

export function MarketingDashboard() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <a href="/" className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
              Kembali ke Hub
            </a>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs">Ganti aplikasi</span>
            <span className="font-semibold text-slate-800">Marketing</span>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            PREVIEW LOKAL
          </span>
        </header>

        <main className="mx-auto max-w-6xl space-y-6 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#E01020]">
                Content Studio / YKP Tim Marketing - WIB
              </p>
              <h1 className="text-2xl font-bold text-ink">Ruang Kerja Tim Marketing</h1>
            </div>
            <BrandSwitcher />
          </div>

          <MetaGuide />

          <section id="arahan-konten" aria-labelledby="arahan-konten-title" className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 id="arahan-konten-title" className="text-lg font-bold text-ink">
                Arahan Konten
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Pilih yang cocok untuk brand. Buka detail untuk melihat bukti, Bedah Referensi, dan
                usulan shot yang bisa direkam.
              </p>
              <p className="mt-1 text-xs text-amber-700">{DISCLAIMERS.reference}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {CONTENT_REFERENCES.map((item) => (
                <ContentReferenceCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
