'use client';
import { toast } from 'sonner';

export function CopyButton({ text }: { text: string }) {
  return (
    <button
      type='button'
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success('Brief tersalin ke clipboard');
        } catch {
          toast.error('Gagal menyalin — salin manual dari teks di bawah');
        }
      }}
      className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'
    >
      Salin Brief
    </button>
  );
}
