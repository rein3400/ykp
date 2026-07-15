import { NextRequest } from 'next/server';
import { clearSession } from '@/lib/session';
import { ok, handler } from '@/lib/http';

export const POST = handler(async (_req: NextRequest) => {
  await clearSession();
  return ok({ logout: true });
});