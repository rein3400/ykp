import { getSession } from '@/lib/session';
import { ok, unauthorized, handler } from '@/lib/http';

export const GET = handler(async () => {
  const session = await getSession();
  if (!session) return unauthorized();
  return ok(session);
});
