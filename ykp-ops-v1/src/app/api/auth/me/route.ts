import { getSession } from '@/lib/session';
import { ok, handler, unauthorized } from '@/lib/http';

export const GET = handler(async () => {
  const session = await getSession();
  if (!session) return unauthorized();
  return ok(session);
});
