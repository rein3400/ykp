"use client";
import * as React from "react";
import { Button } from "@ykp/ui";
import { useUploadPosPhoto } from "../api/mutations";
import { ImagePlus, X } from "lucide-react";

export interface PosPhotoUploadProps {
  outletId: string;
  date: string;
  value?: { url: string; path: string };
  onChange: (value?: { url: string; path: string }) => void;
}

export function PosPhotoUpload({ outletId, date, value, onChange }: PosPhotoUploadProps) {
  const upload = useUploadPosPhoto();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("outlet_id", outletId);
    fd.append("date", date);
    try {
      const res = await upload.mutateAsync(fd);
      onChange({ url: res.publicUrl, path: res.path });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal");
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Foto Nota</label>
      {value ? (
        <div className="relative w-48">
          <img src={value.url} alt="receipt" className="rounded-md border object-cover" />
          <button
            type="button"
            aria-label="Hapus foto nota"
            onClick={() => onChange(undefined)}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
          <ImagePlus className="mr-2 h-4 w-4" /> {upload.isPending ? "Uploading..." : "Upload Foto"}
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  );
}
