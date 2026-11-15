'use client';

export function EditMasterButton({ id, label = 'Edit' }: { id: string; label?: string }) {
  return (
    <button
      type='button'
      onClick={() => {
        window.dispatchEvent(new CustomEvent('master-edit', { detail: id }));
        document.getElementById('master-edit')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }}
      className='rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted'
    >
      {label}
    </button>
  );
}
