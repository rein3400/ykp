/**
 * Investor account administration (owner only).
 * GET  — investors joined with current shareholding + documents.
 * POST — create investor account: master_investor + login user +
 *        initial shareholding (+ share history) + optional MOU document.
 */
import { NextRequest } from 'next/server';
import { readTab, readTabSafe, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, forbidden, badRequest, conflict, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { hashPassword } from '@/lib/password';
import { nowTimestampWib, todayWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (s.role !== 'owner') return forbidden('Owner only');
  const [investors, shareholding, documents, users] = await Promise.all([
    readTabSafe<Record<string, string>>(TABS.investors),
    readTabSafe<Record<string, string>>(TABS.shareholding),
    readTabSafe<Record<string, string>>(TABS.documents),
    readTabSafe<Record<string, string>>(TABS.users)
  ]);
  const rows = investors.map((inv) => ({
    ...inv,
    shareholding: shareholding.filter((sh) => sh.investor_id === inv.investor_id),
    documents: documents.filter((d) => d.investor_id === inv.investor_id),
    login_username: users.find((u) => u.investor_id === inv.investor_id)?.username ?? ''
  }));
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (s.role !== 'owner') return forbidden('Only owner can add investors');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const name = (body.investor_name ?? '').trim();
  if (!name) return badRequest('investor_name wajib diisi');
  const username = (body.username ?? '').trim();
  if (username.length < 3) return badRequest('username minimal 3 karakter');
  const password = body.password ?? '';
  if (password.length < 6) return badRequest('password minimal 6 karakter');
  const sharePct = Number(body.share_pct ?? NaN);
  if (!Number.isFinite(sharePct) || sharePct <= 0 || sharePct > 100) {
    return badRequest('share_pct harus angka 0–100');
  }
  const brandId = (body.brand_id ?? '').trim();
  if (!brandId) return badRequest('brand_id wajib diisi');

  const existingUsers = await readTab<Record<string, string>>(TABS.users);
  if (existingUsers.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return conflict(`username sudah dipakai: ${username}`);
  }

  const now = nowTimestampWib();
  const investorId = nextSequentialIdSync('INV');
  const joinDate = body.join_date || todayWib();

  const investor = {
    investor_id: investorId,
    investor_name: name,
    email: body.email ?? '',
    phone: body.phone ?? '',
    company: body.company ?? '',
    investor_type: body.investor_type ?? 'individual',
    join_date: joinDate,
    status: 'active',
    note: body.note ?? '',
    created_at: now
  };
  await appendRows(TABS.investors, [investor]);

  const user = {
    user_id: nextSequentialIdSync('USR'),
    username,
    password_hash: await hashPassword(password),
    role: 'investor',
    investor_id: investorId,
    active_status: 'active',
    created_at: now,
    last_login_at: ''
  };
  await appendRows(TABS.users, [user]);

  // Initial profit-share percentage (current + effective-dated history).
  const share = {
    share_id: nextSequentialIdSync('SHR'),
    investor_id: investorId,
    brand_id: brandId,
    brand_name: body.brand_name ?? '',
    share_pct: String(sharePct),
    share_value: body.share_value ?? '',
    valuation_date: joinDate,
    last_updated: now
  };
  await appendRows(TABS.shareholding, [share]);
  await appendRows(TABS.shareHistory, [{
    hist_id: nextSequentialIdSync('SHH'),
    investor_id: investorId,
    brand_id: brandId,
    share_pct: String(sharePct),
    effective_date: joinDate,
    created_by: s.userId,
    created_at: now
  }]);

  // Optional MOU document (photo/PDF uploaded earlier via attachments API).
  let document: Record<string, string> | null = null;
  if (body.mou_attachment_id) {
    const photo = await findRow(TABS.attachments, 'attachment_id', body.mou_attachment_id);
    if (!photo) return badRequest(`MOU attachment tidak ditemukan: ${body.mou_attachment_id}`);
    document = {
      doc_id: nextSequentialIdSync('DOC'),
      investor_id: investorId,
      doc_type: 'MOU',
      attachment_id: body.mou_attachment_id,
      signed_date: body.mou_signed_date ?? joinDate,
      expiry_date: body.mou_expiry_date ?? '',
      note: body.mou_note ?? '',
      created_at: now
    };
    await appendRows(TABS.documents, [document]);
    await updateRow(TABS.attachments, photo.rowNumber, {
      ...photo.row,
      entity_type: 'mou',
      entity_id: investorId
    }).catch(() => null);
  }

  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'create',
    entity: 'investor',
    entityId: investorId,
    afterValue: JSON.stringify({ investor, username, share_pct: sharePct, brand_id: brandId, mou: Boolean(document) })
  }).catch(() => null);

  return ok({ investor, username, shareholding: share, document }, 201);
});
