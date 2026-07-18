"use client";

import * as React from "react";

export interface EvidenceFile {
  url: string;
  path: string;
  media_type: "image" | "video";
}

export interface EvidenceUploadProps {
  transactionType: string;
  transactionId?: string;
  value: EvidenceFile[];
  onChange: (files: EvidenceFile[]) => void;
  disabled?: boolean;
  label?: string;
}

export function EvidenceUpload({
  transactionType,
  transactionId,
  value,
  onChange,
  disabled,
  label = "Bukti Foto/Video",
}: EvidenceUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("transaction_type", transactionType);
      if (transactionId) fd.append("transaction_id", transactionId);
      const res = await fetch("/api/warehouse/evidence/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Upload gagal");
      }
      const data = json.data as {
        publicUrl: string;
        path: string;
        media_type: "image" | "video";
      };
      onChange([
        ...value,
        {
          url: data.publicUrl,
          path: data.path,
          media_type: data.media_type,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload gagal");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (idx: number) => {
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium">{label}</label>
      <div className="flex flex-wrap gap-2">
        {value.map((f, i) => (
          <div
            key={f.path || f.url + i}
            className="relative h-20 w-20 overflow-hidden rounded-md border border-border"
          >
            {f.media_type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.url} alt="evidence" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-[10px]">
                VIDEO
              </div>
            )}
            <button
              type="button"
              aria-label="Hapus bukti"
              onClick={() => remove(i)}
              className="absolute right-0.5 top-0.5 rounded-full bg-destructive px-1 text-[10px] text-white"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="flex h-20 w-20 flex-col items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {uploading ? "Upload..." : "+ Tambah"}
        </button>
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          files.forEach((f) => void onFile(f));
        }}
      />
    </div>
  );
}
