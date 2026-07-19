'use client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type='button'
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
        toast.success('Logout berhasil');
        router.push('/login');
      }}
      className='rounded border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted'
    >
      Logout
    </button>
  );
}
