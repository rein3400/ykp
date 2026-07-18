/**
 * Evidence log helpers — append / find photo-video proof for warehouse txs.
 */
import { appendRows, readTab, TABS } from "@/db/sheets";
import { nextSequentialIdSync } from "@/lib/repo";
import { nowTimestampWib } from "@/lib/format";
import { logAudit } from "@/lib/audit";

export type MediaType = "image" | "video";

export interface EvidenceFile {
  url: string;
  path: string;
  media_type: MediaType;
}

export interface EvidenceLogRow {
  evidence_id: string;
  transaction_type: string;
  transaction_id: string;
  file_url: string;
  file_path: string;
  media_type: MediaType | string;
  recorded_by: string;
  recorded_at: string;
  notes: string;
}

export async function appendEvidenceRows(
  transactionType: string,
  transactionId: string,
  files: EvidenceFile[],
  userId: string,
  notes = ""
): Promise<EvidenceLogRow[]> {
  if (!files?.length) return [];
  const now = nowTimestampWib();
  const rows: EvidenceLogRow[] = files.map((f) => ({
    evidence_id: nextSequentialIdSync("EV"),
    transaction_type: transactionType,
    transaction_id: transactionId,
    file_url: f.url,
    file_path: f.path,
    media_type: f.media_type,
    recorded_by: userId,
    recorded_at: now,
    notes,
  }));
  await appendRows(
    TABS.evidenceLog,
    rows.map((r) => ({
      evidence_id: r.evidence_id,
      transaction_type: r.transaction_type,
      transaction_id: r.transaction_id,
      file_url: r.file_url,
      file_path: r.file_path,
      media_type: String(r.media_type),
      recorded_by: r.recorded_by,
      recorded_at: r.recorded_at,
      notes: r.notes,
    }))
  );
  await logAudit({
    module: "warehouse",
    action: "evidence:created",
    recordType: transactionType,
    recordId: transactionId,
    afterValue: JSON.stringify(rows.map((r) => r.file_path)),
    userId,
  }).catch(() => null);
  return rows;
}

export async function findEvidenceByTransaction(
  type: string,
  transactionId: string
): Promise<EvidenceLogRow[]> {
  const all = await readTab<Record<string, string>>(TABS.evidenceLog);
  return all
    .filter(
      (r) =>
        r.transaction_type === type && r.transaction_id === transactionId
    )
    .map((r) => ({
      evidence_id: r.evidence_id,
      transaction_type: r.transaction_type,
      transaction_id: r.transaction_id,
      file_url: r.file_url,
      file_path: r.file_path,
      media_type: (r.media_type as MediaType) || "image",
      recorded_by: r.recorded_by,
      recorded_at: r.recorded_at,
      notes: r.notes ?? "",
    }));
}

/** Normalize optional evidence_urls payload from client. */
export function parseEvidenceUrls(raw: unknown): EvidenceFile[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const url = String(o.url ?? "");
      const path = String(o.path ?? "");
      const media =
        o.media_type === "video" ? ("video" as const) : ("image" as const);
      if (!url) return null;
      return { url, path, media_type: media };
    })
    .filter((x): x is EvidenceFile => Boolean(x));
}
