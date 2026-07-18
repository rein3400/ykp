/**
 * POST /api/fin/pos/upload — upload a receipt photo to Supabase Storage.
 *
 * Form fields:
 *   - file: image/jpeg | image/png | image/webp (max 10MB)
 *   - outlet_id: string
 *   - date: YYYY-MM-DD
 *
 * Returns { publicUrl, path }.
 */
import { handler, ok, fail } from "@finance/lib/server/http";
import { requireRole } from "@ykp/auth";
import { Role, BUCKET_POS_RECEIPTS } from "@ykp/config";
import { getSupabaseAdmin } from "@finance/lib/supabase";
import { randomUUID } from "crypto";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const POST = handler(async (req: Request) => {
  await requireRole([
    Role.FINANCE_ADMIN,
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.OUTLET_MANAGER,
  ]);

  const form = await req.formData();
  const file = form.get("file");
  const outletId = form.get("outlet_id")?.toString();
  const date = form.get("date")?.toString();

  if (!file || !(file instanceof File))
    return fail("validation_error", "Missing file");
  if (file.size > MAX_SIZE)
    return fail("validation_error", "File too large (max 10MB)");
  if (!ALLOWED_TYPES.includes(file.type))
    return fail("validation_error", "Invalid file type (jpeg, png, webp only)");
  if (!outletId || !date)
    return fail("validation_error", "Missing outlet_id or date");

  const ext = file.type.split("/")[1];
  const path = `pos-receipts/${outletId}/${date}/${randomUUID()}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(BUCKET_POS_RECEIPTS)
    .upload(path, file, { contentType: file.type });

  if (error) return fail("storage_error", error.message);

  const { data: publicData } = supabase.storage
    .from(BUCKET_POS_RECEIPTS)
    .getPublicUrl(path);

  return ok({ publicUrl: publicData.publicUrl, path });
});
