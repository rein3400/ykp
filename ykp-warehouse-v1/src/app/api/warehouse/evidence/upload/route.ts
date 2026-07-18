/**
 * POST /api/warehouse/evidence/upload
 * Multipart: file, transaction_type, transaction_id?
 * Returns { publicUrl, path, media_type }.
 *
 * When Supabase is not configured (mock mode), stores a data-URL stub so the
 * rest of the evidence flow remains testable without real storage credentials.
 */
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { handler, ok, unauthorized, badRequest } from "@/lib/http";
import { getSession } from "@/lib/session";
import { BUCKET_WAREHOUSE_EVIDENCE } from "@/lib/config";
import { getSupabaseAdmin, hasSupabaseStorage } from "@/lib/supabase";

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm"];

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();

  const form = await req.formData();
  const file = form.get("file");
  const transactionType = form.get("transaction_type")?.toString() || "misc";
  const transactionId = form.get("transaction_id")?.toString() || "pending";

  if (!file || !(file instanceof File)) return badRequest("Missing file");

  const isVideo = file.type.startsWith("video/");
  const allowed = isVideo ? ALLOWED_VIDEO : ALLOWED_IMAGE;
  const max = isVideo ? MAX_VIDEO : MAX_IMAGE;
  if (!allowed.includes(file.type)) {
    return badRequest("Invalid file type (image jpeg/png/webp or video mp4/webm)");
  }
  if (file.size > max) {
    return badRequest(`File too large (max ${isVideo ? "50MB video" : "10MB image"})`);
  }

  const ext = file.type.split("/")[1] || "bin";
  const path = `warehouse/${transactionType}/${transactionId}/${randomUUID()}.${ext}`;
  const media_type = isVideo ? "video" : "image";

  // Mock / no credentials: return a placeholder so UI can still wire evidence_urls
  if (!hasSupabaseStorage()) {
    const publicUrl = `https://placeholder.local/${path}`;
    return ok({ publicUrl, path, media_type, mock: true });
  }

  const supabase = getSupabaseAdmin();
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET_WAREHOUSE_EVIDENCE)
    .upload(path, buf, { contentType: file.type, upsert: false });
  if (error) return badRequest(`storage_error: ${error.message}`);

  const { data } = supabase.storage
    .from(BUCKET_WAREHOUSE_EVIDENCE)
    .getPublicUrl(path);

  return ok({ publicUrl: data.publicUrl, path, media_type });
});
