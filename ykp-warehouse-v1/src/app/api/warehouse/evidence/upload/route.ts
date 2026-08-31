/**
 * POST /api/warehouse/evidence/upload
 * Multipart: file, transaction_type, transaction_id?
 * Returns { publicUrl, path, media_type }.
 *
 * Storage: Supabase when configured; otherwise files are persisted on local
 * disk under .data/evidence/ and served back via /evidence/file route. Every
 * upload MUST return a retrievable URL — photographic evidence is a fraud
 * control, so a placeholder-only response is unacceptable.
 */
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { handler, ok, unauthorized, badRequest } from "@/lib/http";
import { getSession } from "@/lib/session";
import { BUCKET_WAREHOUSE_EVIDENCE } from "@/lib/config";
import { getSupabaseAdmin, hasSupabaseStorage } from "@/lib/supabase";

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm"];

function evidenceDir(): string {
  return path.join(process.cwd(), ".data", "evidence");
}

function sanitizeSegment(seg: string): string {
  return seg.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60) || "misc";
}

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
  const media_type = isVideo ? "video" : "image";

  // No Supabase credentials: persist to local disk so the evidence URL is
  // actually retrievable (photographic proof must not be a dead placeholder).
  if (!hasSupabaseStorage()) {
    const safeTransaction = sanitizeSegment(transactionType);
    const safeId = sanitizeSegment(transactionId);
    const fileName = `${randomUUID()}.${ext}`;
    const dir = path.join(evidenceDir(), safeTransaction, safeId);
    fs.mkdirSync(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(dir, fileName), buf);
    const storagePath = `${safeTransaction}/${safeId}/${fileName}`;
    return ok({
      publicUrl: `/api/warehouse/evidence/file/${storagePath}`,
      path: storagePath,
      media_type
    });
  }

  const supabase = getSupabaseAdmin();
  const storagePath = `warehouse/${transactionType}/${transactionId}/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET_WAREHOUSE_EVIDENCE)
    .upload(storagePath, buf, { contentType: file.type, upsert: false });
  if (error) return badRequest(`storage_error: ${error.message}`);

  const { data } = supabase.storage
    .from(BUCKET_WAREHOUSE_EVIDENCE)
    .getPublicUrl(storagePath);

  return ok({ publicUrl: data.publicUrl, path: storagePath, media_type });
});
