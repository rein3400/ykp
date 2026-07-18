import { clearSession } from '@/lib/session';
import { ok, handler } from '@/lib/http';

export const POST = handler(async () => {
  await clearSession();
  return ok({ success: true });
});
