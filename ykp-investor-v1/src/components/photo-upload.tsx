'use client';
/**
 * Camera-first photo uploader with proof watermark (images), with optional
 * PDF passthrough for MOU documents (PDFs upload as-is, no watermark).
 */
import { useRef, useState } from 'react';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

interface Props {
  entityType: string;
  onUploaded: (attachmentId: string) => void;
  label?: string;
  allowPdf?: boolean;
}

function wibTimestamp(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} WIB`;
}

async function compressWithWatermark(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak didukung browser ini');
  ctx.drawImage(bitmap, 0, 0, w, h);
  const text = wibTimestamp();
  const fontPx = Math.max(14, Math.round(w / 55));
  ctx.font = `bold ${fontPx}px sans-serif`;
  const pad = Math.round(fontPx * 0.6);
  const textW = ctx.measureText(text).width;
  const stripH = fontPx + pad * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, h - stripH, textW + pad * 2, stripH);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, h - stripH / 2);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) throw new Error('Gagal kompres foto');
  bitmap.close();
  return blob;
}

export default function PhotoUpload({ entityType, onUploaded, label = 'Foto/dokumen', allowPdf = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);

  async function handleFile(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const pdf = file.type === 'application/pdf';
      if (pdf && !allowPdf) throw new Error('PDF tidak diizinkan di sini');
      if (!pdf && !file.type.startsWith('image/')) throw new Error('Hanya gambar atau PDF');
      const blob = pdf ? file : await compressWithWatermark(file);
      const fd = new FormData();
      fd.set('file', new File([blob], pdf ? file.name : `bukti-${Date.now()}.jpg`, { type: pdf ? 'application/pdf' : 'image/jpeg' }));
      fd.set('entity_type', entityType);
      fd.set('entity_id', '');
      const r = await fetch('/api/investor/attachments', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? 'Upload gagal');
      const id = j.data.attachment_id as string;
      setDoneId(id);
      setIsPdf(pdf);
      setPreview(pdf ? null : `/api/investor/attachments/${id}/file`);
      onUploaded(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload gagal');
      setPreview(null);
      setDoneId(null);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPreview(null);
    setDoneId(null);
    setIsPdf(false);
    setErr(null);
    onUploaded('');
    inputRef.current?.click();
  }

  return (
    <div className='rounded border border-border p-2'>
      <p className='mb-1.5 text-[11px] font-semibold'>
        {label}
        <span className='ml-1 font-normal text-muted-foreground'>
          ({allowPdf ? 'foto atau PDF' : 'foto dari kamera HP'})
        </span>
      </p>
      <input
        ref={inputRef}
        type='file'
        accept={allowPdf ? 'image/*,application/pdf' : 'image/*'}
        capture={allowPdf ? undefined : 'environment'}
        className='hidden'
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      {doneId ? (
        <div className='space-y-1.5'>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt='Bukti' className='max-h-40 rounded border border-border' />
          )}
          {isPdf && <p className='text-[11px] text-muted-foreground'>📄 PDF terlampir</p>}
          <div className='flex items-center gap-2'>
            <span className='text-[10px] text-emerald-700'>✓ Terunggah ({doneId})</span>
            <button type='button' onClick={reset} className='rounded border border-border px-2 py-0.5 text-[10px]'>
              Ganti
            </button>
          </div>
        </div>
      ) : (
        <button
          type='button'
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className='rounded bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50'
        >
          {busy ? 'Mengunggah…' : '📎 Pilih file'}
        </button>
      )}
      {err && <p className='mt-1 text-[11px] text-red-600'>{err}</p>}
    </div>
  );
}
