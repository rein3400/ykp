import { LoginForm } from '@/features/auth/login-form';

export default function LoginPage() {
  return (
    <div className='flex min-h-screen items-center justify-center bg-muted'>
      <div className='w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-sm'>
        <h1 className='mb-1 text-xl font-bold'>YKP HR V1</h1>
        <p className='mb-4 text-xs text-muted-foreground'>Login dengan akun owner / HR admin</p>
        <LoginForm />
      </div>
    </div>
  );
}