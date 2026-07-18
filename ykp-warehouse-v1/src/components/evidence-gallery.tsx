"use client";

import * as React from "react";
import type { EvidenceFile } from "./evidence-upload";

export function EvidenceGallery({ files }: { files: EvidenceFile[] }) {
  const [preview, setPreview] = React.useState<EvidenceFile | null>(null);
  if (!files?.length) {
    return <span className="text-[10px] text-muted-foreground">-</span>;
  }
  return (
    <>
      <div className="flex flex-wrap gap-1">
        {files.map((f, i) => (
          <button
            key={f.path || f.url + i}
            type="button"
            onClick={() => setPreview(f)}
            className="h-10 w-10 overflow-hidden rounded border border-border"
            title="Lihat bukti"
          >
            {f.media_type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.url} alt="evidence" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-[9px]">
                VID
              </div>
            )}
          </button>
        ))}
      </div>
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="max-h-[90vh] max-w-3xl overflow-auto rounded-md bg-background p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {preview.media_type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt="evidence" className="max-h-[80vh] w-full object-contain" />
            ) : (
              <video src={preview.url} controls className="max-h-[80vh] w-full" />
            )}
            <button
              type="button"
              className="mt-2 rounded border border-border px-2 py-1 text-xs"
              onClick={() => setPreview(null)}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
}
