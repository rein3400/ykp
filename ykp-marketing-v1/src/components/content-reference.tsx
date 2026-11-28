'use client';
import { useState } from 'react';
import type { ContentReference } from '@/data/marketing-preview';

export function ContentReferenceCard({ item }: { item: ContentReference }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#E01020]">
          {item.category}
        </span>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
          Referensi nyata — {item.evidence}
        </span>
      </div>
      <p className="mt-2 text-xs font-medium text-slate-500">{item.brand}</p>
      <h3 className="text-base font-bold text-ink">{item.heading}</h3>
      <p className="mt-1 text-sm text-slate-600">{item.summary}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
        <div>
          <dt className="text-slate-400">Sumber</dt>
          <dd>{item.sourceName}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Posting asli</dt>
          <dd>{item.originalPostDate}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Performa terkini</dt>
          <dd>{item.performance}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Metadata dicek</dt>
          <dd>{item.metadataCheckedAt}</dd>
        </div>
      </dl>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="mt-3 inline-block rounded-lg bg-[#E01020] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#9c0b16]"
      >
        {open ? 'Tutup detail' : 'Lihat arahan & bedah'}
      </button>
      {open && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          <p>
            <span className="font-semibold text-slate-800">Bedah Referensi:</span> {item.summary}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-800">Usulan shot:</span> rekam proses{' '}
            {item.category.toLowerCase()} dari persiapan sampai hasil.
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-800">Tautan asli:</span> {item.sourceName} ·{' '}
            {item.originalPostDate}
          </p>
        </div>
      )}
    </article>
  );
}
