'use client';
import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './sidebar';
import { BrandSwitcher } from './brand-switcher';
import { MetaGuide } from './meta-guide';
import { ContentReferenceCard } from './content-reference';
import { ContentPlanner } from './content-planner';
import { CONTENT_REFERENCES, DISCLAIMERS, META_GUIDE_ITEMS } from '@/data/marketing-preview';
import {
  ALL_BRANDS,
  STORAGE_KEYS,
  filterReferences,
  toggleDone
} from '@/lib/marketing-state';

export function MarketingDashboard() {
  const [brand, setBrand] = useState<string>(ALL_BRANDS);
  const [guide, setGuide] = useState(META_GUIDE_ITEMS);

  useEffect(() => {
    try {
      const savedBrand = localStorage.getItem(STORAGE_KEYS.brand);
      if (savedBrand) setBrand(savedBrand);
      const savedGuide = localStorage.getItem(STORAGE_KEYS.guide);
      if (savedGuide) {
        const done = JSON.parse(savedGuide) as Record<string, boolean>;
        setGuide((prev) => prev.map((item) => ({ ...item, done: done[item.id] ?? item.done })));
      }
    } catch {
      // ignore unavailable storage
    }
  }, []);

  function selectBrand(next: string) {
    setBrand(next);
    try {
      localStorage.setItem(STORAGE_KEYS.brand, next);
    } catch {
      // ignore
    }
  }

  function toggleGuideItem(id: string) {
    setGuide((prev) => {
      const next = toggleDone(prev, id);
      try {
        const done: Record<string, boolean> = {};
        for (const item of next) done[item.id] = item.done;
        localStorage.setItem(STORAGE_KEYS.guide, JSON.stringify(done));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const references = useMemo(() => filterReferences(CONTENT_REFERENCES, brand), [brand]);

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
            <BrandSwitcher selected={brand} onSelect={selectBrand} />
          </div>

          <MetaGuide items={guide} onToggle={toggleGuideItem} />

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
              {references.map((item) => (
                <ContentReferenceCard key={item.id} item={item} />
              ))}
            </div>
            {references.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Belum ada arahan konten untuk brand ini.
              </p>
            )}
          </section>

          <ContentPlanner brand={brand} />
        </main>
      </div>
    </div>
  );
}
