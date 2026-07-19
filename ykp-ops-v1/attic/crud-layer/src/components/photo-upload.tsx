'use client';
/**
 * Camera-first photo uploader with proof watermark.
 * Phone camera ΓåÆ canvas resize (Γëñ1600px JPEG) ΓåÆ watermark strip
 * (timestamp WIB + GPS if permitted) ΓåÆ POST /api/ops/attachments.
 * Watermark is burned client-side so even the stored original carries it.
 */
import { useRef, useState } from 'react';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

interface Props {
  entityType: string;
  onUploaded: (attachmentId: string) => void;
  label?: string;
}

function wibTimestamp(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} WIB`;
}

async function getCoords(): Promise<string> {
  if (!('geolocation' in navigator)) return '';
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(`${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`),
      () => resolve(''),
      { timeout: 3000, maximumAge: 60000 }
    );
  });
}

async function compressWithWatermark(file: File, coords: string): Promise<Blob> {
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

  // Watermark strip: timestamp + GPS ΓÇö anti backdating / anti reuse.
  const text = `${wibTimestamp()}${coords ? ` ┬╖ ${coords}` : ''}`;
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

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  );
  if (!blob) throw new Error('Gagal kompres foto');
  bitmap.close();
  return blob;
}

export default function PhotoUpload({ entityType, onUploaded, label = 'Foto bukti' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  async function handleFile(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const coords = await getCoords();
      const blob = await compressWithWatermark(file, coords);
      const fd = new FormData();
      fd.set('file', new File([blob], `bukti-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      fd.set('entity_type', entityType);
      fd.set('entity_id', '');
      const r = await fetch('/api/ops/attachments', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? 'Upload gagal');
      const id = j.data.attachment_id as string;
      setDoneId(id);
      setPreview(`/api/ops/attachments/${id}/file`);
      onUploaded(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload gagal');
      setPreview(null);
      setDoneId(null);
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setPreview(null);
    setDoneId(null);
    setErr(null);
    onUploaded('');
    inputRef.current?.click();
  }

  return (
    <div className='rounded border border-border p-2'>
      <p className='mb-1.5 text-[11px] font-semibold'>
        {label} <span className='text-red-600'>*</span>
        <span className='ml-1 font-normal text-muted-foreground'>(wajib ΓÇö dari kamera HP)</span>
      </p>
      <input
        ref={inputRef}
        type='file'
        accept='image/*'
        capture='environment'
        className='hidden'
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      {preview ? (
        <div className='space-y-1.5'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt='Foto bukti' className='max-h-48 rounded border border-border' />
          <div className='flex items-center gap-2'>
            <span className='text-[10px] text-emerald-700'>Γ£ô Terunggah ({doneId})</span>
            <button
              type='button'
              onClick={retake}
              className='rounded border border-border px-2 py-0.5 text-[10px]'
            >
              Foto ulang
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
          {busy ? 'MengunggahΓÇª' : '≡ƒô╖ Ambil foto'}
        </button>
      )}
      {err && <p className='mt-1 text-[11px] text-red-600'>{err}</p>}
    </div>
  );
}
