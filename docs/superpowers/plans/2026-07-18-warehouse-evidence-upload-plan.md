# Warehouse Evidence Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add photo/video evidence upload to all warehouse transaction forms (receiving, stock issue, transfer, waste, stock count) so physical quantities can be verified against recorded data.

**Architecture:** A dedicated `evidence_log` Google Sheets tab stores references to files uploaded to Supabase Storage. Transaction forms collect evidence URLs and submit them with the rest of the payload. A shared `EvidenceUpload` component handles compression, preview, and Supabase upload, while an `EvidenceGallery` component renders thumbnails and video players in list/detail views.

**Tech Stack:** Next.js 16, Google Sheets API, Supabase Storage, TanStack Query, shadcn/ui, TypeScript, vitest.

---

## File Map

- `ykp-warehouse-v1/src/db/sheets.ts` — add `EVIDENCE_LOG` tab headers and helpers.
- `ykp-warehouse-v1/scripts/bootstrap.ts` — add `evidence_log` tab to bootstrap.
- `ykp-warehouse-v1/src/lib/supabase.ts` — Supabase storage admin client.
- `ykp-warehouse-v1/src/lib/schemas.ts` — add `evidence_urls` to transaction schemas.
- `ykp-warehouse-v1/src/lib/repo.ts` — add evidence log write/read helpers.
- `ykp-warehouse-v1/src/components/evidence-upload.tsx` — shared upload UI.
- `ykp-warehouse-v1/src/components/evidence-gallery.tsx` — shared preview gallery.
- `ykp-warehouse-v1/src/app/api/warehouse/receiving/route.ts` — accept evidence.
- `ykp-warehouse-v1/src/app/warehouse/penerimaan/receiving-client.tsx` — upload UI.
- `ykp-warehouse-v1/src/app/api/warehouse/stock-issue/route.ts` — accept evidence.
- `ykp-warehouse-v1/src/app/warehouse/pemakaian/issue-client.tsx` — upload UI.
- `ykp-warehouse-v1/src/app/api/warehouse/transfer/route.ts` — accept evidence.
- `ykp-warehouse-v1/src/app/warehouse/transfer/transfer-client.tsx` — upload UI.
- `ykp-warehouse-v1/src/app/api/warehouse/waste/route.ts` — accept evidence.
- `ykp-warehouse-v1/src/app/warehouse/waste/waste-client.tsx` — upload UI.
- `ykp-warehouse-v1/src/app/api/warehouse/stock-count/route.ts` — accept evidence.
- `ykp-warehouse-v1/src/app/warehouse/opname/opname-client.tsx` — upload UI.
- `ykp-warehouse-v1/src/app/api/warehouse/evidence/route.ts` — standalone evidence CRUD.
- `ykp-warehouse-v1/src/app/api/warehouse/[transaction]/[id]/evidence/route.ts` — per-transaction evidence list (optional).
- `ykp-warehouse-v1/.env.example` — add Supabase env vars.

---

### Task 1: Schema & Sheets Tab

**Files:**
- Modify: `ykp-warehouse-v1/src/db/sheets.ts`
- Modify: `ykp-warehouse-v1/scripts/bootstrap.ts`

- [ ] **Step 1: Add `EVIDENCE_LOG` headers and tab name**

  In `sheets.ts`:

  ```ts
  export const EVIDENCE_LOG = "evidence_log";

  export const EVIDENCE_LOG_HEADERS = [
    "evidence_id",
    "transaction_type",
    "transaction_id",
    "file_url",
    "file_path",
    "media_type",
    "recorded_by",
    "recorded_at",
    "notes",
  ];

  export const TABS = {
    // ...existing tabs
    evidence_log: {
      name: EVIDENCE_LOG,
      headers: EVIDENCE_LOG_HEADERS,
    },
  };
  ```

  Add `evidence_log` to `TAB_HEADERS` constant if that is the single source used elsewhere.

- [ ] **Step 2: Add helper functions**

  In `sheets.ts` (or `repo.ts`):

  ```ts
  export interface EvidenceLogRow {
    evidence_id: string;
    transaction_type: string;
    transaction_id: string;
    file_url: string;
    file_path: string;
    media_type: "image" | "video";
    recorded_by: string;
    recorded_at: string;
    notes: string;
  }

  export async function appendEvidenceRows(rows: EvidenceLogRow[]) {
    return appendRows(EVIDENCE_LOG, rows.map((r) => TABS.evidence_log.headers.map((h) => (r as any)[h] ?? "")));
  }

  export async function findEvidenceByTransaction(type: string, transactionId: string): Promise<EvidenceLogRow[]> {
    const all = await readTab(EVIDENCE_LOG);
    return all
      .slice(1)
      .map((row) => Object.fromEntries(TABS.evidence_log.headers.map((h, i) => [h, row[i] ?? ""])) as EvidenceLogRow)
      .filter((r) => r.transaction_type === type && r.transaction_id === transactionId);
  }
  ```

- [ ] **Step 3: Add tab to bootstrap**

  In `bootstrap.ts`, add `EVIDENCE_LOG` to the list of tabs created if not exists. Do not seed rows.

- [ ] **Step 4: Run bootstrap**

  ```bash
  cd ykp-warehouse-v1
  npm run sheets:bootstrap
  ```

  Expected: `evidence_log` tab created.

- [ ] **Step 5: Commit**

  ```bash
  git add ykp-warehouse-v1/src/db/sheets.ts ykp-warehouse-v1/scripts/bootstrap.ts
  git commit -m "feat(warehouse): evidence_log tab and helpers"
  ```

---

### Task 2: Supabase Storage Client

**Files:**
- Create: `ykp-warehouse-v1/src/lib/supabase.ts`
- Modify: `ykp-warehouse-v1/.env.example`

- [ ] **Step 1: Create client**

  ```ts
  import { createClient } from "@supabase/supabase-js";

  export function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase credentials");
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  ```

- [ ] **Step 2: Add env vars**

  `.env.example`:

  ```env
  NEXT_PUBLIC_SUPABASE_URL=
  SUPABASE_SERVICE_ROLE_KEY=
  ```

- [ ] **Step 3: Install dependency if missing**

  ```bash
  cd ykp-warehouse-v1
  npm install @supabase/supabase-js
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add ykp-warehouse-v1/src/lib/supabase.ts ykp-warehouse-v1/.env.example ykp-warehouse-v1/package.json
  git commit -m "feat(warehouse): Supabase storage client"
  ```

---

### Task 3: Shared Evidence Upload Component

**Files:**
- Create: `ykp-warehouse-v1/src/components/evidence-upload.tsx`

- [ ] **Step 1: Implement component**

  ```tsx
  "use client";
  import * as React from "react";
  import { Button } from "@/components/ui/button";
  import { ImagePlus, X, Video } from "lucide-react";
  import { getSupabaseAdmin } from "@/lib/supabase";
  import { BUCKET_WAREHOUSE_EVIDENCE } from "@/lib/config";
  import { randomUUID } from "crypto";

  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
  const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
  const ALLOWED_VIDEO = ["video/mp4", "video/webm"];

  export interface EvidenceFile {
    url: string;
    path: string;
    media_type: "image" | "video";
  }

  export interface EvidenceUploadProps {
    transactionType: string;
    transactionId?: string;
    value: EvidenceFile[];
    onChange: (files: EvidenceFile[]) => void;
    disabled?: boolean;
  }

  export function EvidenceUpload({ transactionType, transactionId, value, onChange, disabled }: EvidenceUploadProps) {
    const [uploading, setUploading] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const onFile = async (file: File) => {
      const isVideo = file.type.startsWith("video/");
      const max = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      const allowed = isVideo ? ALLOWED_VIDEO : ALLOWED_IMAGE;
      if (!allowed.includes(file.type)) return alert("Tipe file tidak didukung");
      if (file.size > max) return alert("File terlalu besar");

      setUploading(true);
      try {
        const supabase = getSupabaseAdmin();
        const id = transactionId ?? randomUUID();
        const ext = file.type.split("/")[1];
        const path = `warehouse/${transactionType}/${id}/${randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET_WAREHOUSE_EVIDENCE).upload(path, file, { contentType: file.type });
        if (error) throw error;
        const { data: publicData } = supabase.storage.from(BUCKET_WAREHOUSE_EVIDENCE).getPublicUrl(path);
        onChange([
          ...value,
          { url: publicData.publicUrl, path, media_type: isVideo ? "video" : "image" },
        ]);
      } catch (e) {
        alert("Upload gagal: " + (e as Error).message);
      } finally {
        setUploading(false);
      }
    };

    const remove = (idx: number) => {
      const next = [...value];
      next.splice(idx, 1);
      onChange(next);
    };

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Bukti Foto/Video</label>
        <div className="flex flex-wrap gap-2">
          {value.map((f, i) => (
            <div key={f.path} className="relative h-24 w-24 overflow-hidden rounded-md border">
              {f.media_type === "image" ? (
                <img src={f.url} alt="evidence" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <Video className="h-8 w-8" />
                </div>
              )}
              <button type="button" onClick={() => remove(i)} className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-white">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={disabled || uploading} className="h-24 w-24 flex-col">
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs">{uploading ? "Upload..." : "Tambah"}</span>
          </Button>
        </div>
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => Array.from(e.target.files ?? []).forEach(onFile)} />
      </div>
    );
  }
  ```

  Note: `crypto.randomUUID` may not be available in all browsers; use a fallback `Math.random().toString(36).slice(2)` if needed.

- [ ] **Step 2: Add bucket constant**

  In `ykp-warehouse-v1/src/lib/config.ts` (or create if not exists):

  ```ts
  export const BUCKET_WAREHOUSE_EVIDENCE = "warehouse-evidence";
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add ykp-warehouse-v1/src/components/evidence-upload.tsx ykp-warehouse-v1/src/lib/config.ts
  git commit -m "feat(warehouse): shared evidence upload component"
  ```

---

### Task 4: Shared Evidence Gallery Component

**Files:**
- Create: `ykp-warehouse-v1/src/components/evidence-gallery.tsx`

- [ ] **Step 1: Implement gallery**

  ```tsx
  "use client";
  import * as React from "react";
  import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
  import { Video } from "lucide-react";
  import type { EvidenceFile } from "./evidence-upload";

  export interface EvidenceGalleryProps {
    files: EvidenceFile[];
  }

  export function EvidenceGallery({ files }: EvidenceGalleryProps) {
    if (!files.length) return <span className="text-muted-foreground text-xs">-</span>;
    return (
      <div className="flex flex-wrap gap-2">
        {files.map((f) => (
          <Dialog key={f.path}>
            <DialogTrigger asChild>
              <button className="h-16 w-16 overflow-hidden rounded-md border">
                {f.media_type === "image" ? (
                  <img src={f.url} alt="evidence" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <Video className="h-6 w-6" />
                  </div>
                )}
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              {f.media_type === "image" ? (
                <img src={f.url} alt="evidence" className="w-full rounded-md" />
              ) : (
                <video src={f.url} controls className="w-full rounded-md" />
              )}
            </DialogContent>
          </Dialog>
        ))}
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add ykp-warehouse-v1/src/components/evidence-gallery.tsx
  git commit -m "feat(warehouse): shared evidence gallery component"
  ```

---

### Task 5: Evidence Audit Logging Helper

**Files:**
- Modify: `ykp-warehouse-v1/src/lib/audit.ts` (or create if not exists)

- [ ] **Step 1: Add evidence audit function**

  If `audit.ts` does not exist, check existing audit logging pattern in `ykp-warehouse-v1/src/lib/repo.ts` and add a helper there.

  ```ts
  export async function logEvidence(
    actor: string,
    action: "evidence:created" | "evidence:deleted",
    transactionType: string,
    transactionId: string,
    filePath: string,
    fileUrl: string
  ) {
    await appendAuditRows([{
      audit_id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor,
      action,
      entity_type: transactionType,
      entity_id: transactionId,
      details: JSON.stringify({ file_path: filePath, file_url: fileUrl }),
    }]);
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add ykp-warehouse-v1/src/lib/audit.ts
  git commit -m "feat(warehouse): evidence audit helper"
  ```

---

### Task 6: Receiving Evidence

**Files:**
- Modify: `ykp-warehouse-v1/src/app/api/warehouse/receiving/route.ts`
- Modify: `ykp-warehouse-v1/src/app/warehouse/penerimaan/receiving-client.tsx`
- Modify: `ykp-warehouse-v1/src/lib/schemas.ts`

- [ ] **Step 1: Update schema**

  Add `evidence_urls: z.array(z.object({ url: z.string(), path: z.string(), media_type: z.enum(["image", "video"]) })).optional()` to the receiving create schema.

- [ ] **Step 2: Update API route**

  After the receiving row is created, call `appendEvidenceRows` for each evidence file with `transaction_type = "receiving"` and `transaction_id = created.receiving_id`. Log to audit.

  ```ts
  if (data.evidence_urls?.length) {
    await appendEvidenceRows(
      data.evidence_urls.map((f) => ({
        evidence_id: `EV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        transaction_type: "receiving",
        transaction_id: created.receivingId,
        file_url: f.url,
        file_path: f.path,
        media_type: f.media_type,
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
        notes: "",
      }))
    );
  }
  ```

- [ ] **Step 3: Update receiving form**

  Add `EvidenceUpload` component bound to `evidence_urls` field. When form submits, the array is already populated.

- [ ] **Step 4: Show evidence in receiving list**

  In the receiving table, add a column that renders `<EvidenceGallery files={row.evidence_urls ?? []} />` if the list endpoint returns evidence. If not, fetch evidence via `findEvidenceByTransaction` in the client and merge.

- [ ] **Step 5: Test**

  Create a receiving record with 2 photos and 1 video. Verify `evidence_log` has 3 rows and the detail modal shows them.

- [ ] **Step 6: Commit**

  ```bash
  git add ykp-warehouse-v1/src/app/api/warehouse/receiving/route.ts ykp-warehouse-v1/src/app/warehouse/penerimaan/receiving-client.tsx ykp-warehouse-v1/src/lib/schemas.ts
  git commit -m "feat(warehouse): evidence upload for receiving"
  ```

---

### Task 7: Stock Issue Evidence

**Files:**
- Modify: `ykp-warehouse-v1/src/app/api/warehouse/stock-issue/route.ts`
- Modify: `ykp-warehouse-v1/src/app/warehouse/pemakaian/issue-client.tsx`
- Modify: `ykp-warehouse-v1/src/lib/schemas.ts`

- [ ] **Step 1: Update schema**

  Add `evidence_urls` optional array to stock-issue schema.

- [ ] **Step 2: Update API route**

  Same pattern as receiving, `transaction_type = "stock_issue"`.

- [ ] **Step 3: Update form**

  Add `EvidenceUpload`.

- [ ] **Step 4: Commit**

  ```bash
  git add ykp-warehouse-v1/src/app/api/warehouse/stock-issue/route.ts ykp-warehouse-v1/src/app/warehouse/pemakaian/issue-client.tsx ykp-warehouse-v1/src/lib/schemas.ts
  git commit -m "feat(warehouse): evidence upload for stock issue"
  ```

---

### Task 8: Transfer Evidence

**Files:**
- Modify: `ykp-warehouse-v1/src/app/api/warehouse/transfer/route.ts`
- Modify: `ykp-warehouse-v1/src/app/warehouse/transfer/transfer-client.tsx`
- Modify: `ykp-warehouse-v1/src/lib/schemas.ts`

- [ ] **Step 1: Update schema**

  Add optional `dispatch_evidence_urls` and `receive_evidence_urls` to transfer schema, or a single `evidence_urls` array. For simplicity, use one `evidence_urls` array but include a `stage` in the evidence row if needed. Recommended: single `evidence_urls` plus `notes` field to note stage.

- [ ] **Step 2: Update API route**

  When transfer is created, write evidence with `transaction_type = "transfer"` and `transaction_id = transfer_id`.

- [ ] **Step 3: Update form**

  Add two `EvidenceUpload` sections: "Bukti Pengiriman" and "Bukti Penerimaan". Combine into one array with optional note like "dispatch" / "receive".

- [ ] **Step 4: Commit**

  ```bash
  git add ykp-warehouse-v1/src/app/api/warehouse/transfer/route.ts ykp-warehouse-v1/src/app/warehouse/transfer/transfer-client.tsx ykp-warehouse-v1/src/lib/schemas.ts
  git commit -m "feat(warehouse): evidence upload for transfer"
  ```

---

### Task 9: Waste Evidence

**Files:**
- Modify: `ykp-warehouse-v1/src/app/api/warehouse/waste/route.ts`
- Modify: `ykp-warehouse-v1/src/app/warehouse/waste/waste-client.tsx`
- Modify: `ykp-warehouse-v1/src/lib/schemas.ts`

- [ ] **Step 1: Update schema**

  Add `evidence_urls` optional array to waste schema.

- [ ] **Step 2: Update API route**

  Write evidence with `transaction_type = "waste"`.

- [ ] **Step 3: Update form**

  Add `EvidenceUpload`.

- [ ] **Step 4: Commit**

  ```bash
  git add ykp-warehouse-v1/src/app/api/warehouse/waste/route.ts ykp-warehouse-v1/src/app/warehouse/waste/waste-client.tsx ykp-warehouse-v1/src/lib/schemas.ts
  git commit -m "feat(warehouse): evidence upload for waste"
  ```

---

### Task 10: Stock Count / Opname Evidence

**Files:**
- Modify: `ykp-warehouse-v1/src/app/api/warehouse/stock-count/route.ts`
- Modify: `ykp-warehouse-v1/src/app/warehouse/opname/opname-client.tsx`
- Modify: `ykp-warehouse-v1/src/lib/schemas.ts`

- [ ] **Step 1: Update schema**

  Add `evidence_urls` optional array to stock-count schema.

- [ ] **Step 2: Update API route**

  Write evidence with `transaction_type = "stock_count"`.

- [ ] **Step 3: Update form**

  Add `EvidenceUpload`.

- [ ] **Step 4: Commit**

  ```bash
  git add ykp-warehouse-v1/src/app/api/warehouse/stock-count/route.ts ykp-warehouse-v1/src/app/warehouse/opname/opname-client.tsx ykp-warehouse-v1/src/lib/schemas.ts
  git commit -m "feat(warehouse): evidence upload for stock count"
  ```

---

### Task 11: Standalone Evidence API

**Files:**
- Create: `ykp-warehouse-v1/src/app/api/warehouse/evidence/route.ts`

- [ ] **Step 1: Implement evidence CRUD**

  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import { appendEvidenceRows, findEvidenceByTransaction, EVIDENCE_LOG_HEADERS } from "@/db/sheets";
  import { requireAuth } from "@/lib/session";

  export async function GET(req: NextRequest) {
    const user = await requireAuth();
    const search = new URL(req.url).searchParams;
    const type = search.get("transaction_type");
    const id = search.get("transaction_id");
    if (!type || !id) return NextResponse.json({ error: { code: "validation_error", message: "Missing params" } }, { status: 400 });
    const rows = await findEvidenceByTransaction(type, id);
    return NextResponse.json({ data: rows });
  }

  export async function POST(req: NextRequest) {
    const user = await requireAuth();
    const body = await req.json();
    // validate body matches EvidenceLogRow shape
    await appendEvidenceRows([{ ...body, recorded_by: user.id, recorded_at: new Date().toISOString() }]);
    return NextResponse.json({ data: body });
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add ykp-warehouse-v1/src/app/api/warehouse/evidence/route.ts
  git commit -m "feat(warehouse): standalone evidence API"
  ```

---

### Task 12: Typecheck + Tests + Bootstrap

**Files:**
- All modified files

- [ ] **Step 1: Run typecheck**

  ```bash
  cd ykp-warehouse-v1
  npm run build
  ```

  Fix errors. Common issues: missing `EvidenceFile` import, `z.array` syntax, `crypto` usage in browser.

- [ ] **Step 2: Run tests**

  ```bash
  cd ykp-warehouse-v1
  npm test
  ```

  Add or update tests for evidence log parsing and schema validation.

- [ ] **Step 3: Bootstrap test spreadsheet**

  Create a fresh Google Sheet, run `npm run sheets:bootstrap`, then create a receiving record with evidence and verify the `evidence_log` tab.

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "chore(warehouse): evidence feature typecheck and tests clean"
  ```

---

## Spec Coverage Self-Review

| Spec Requirement | Plan Task |
|---|---|
| `evidence_log` tab | Task 1 |
| Supabase client | Task 2 |
| Evidence upload component | Task 3 |
| Evidence gallery component | Task 4 |
| Audit logging | Task 5 |
| Receiving evidence | Task 6 |
| Stock issue evidence | Task 7 |
| Transfer evidence | Task 8 |
| Waste evidence | Task 9 |
| Stock count evidence | Task 10 |
| Standalone evidence API | Task 11 |
| Typecheck + tests | Task 12 |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-18-warehouse-evidence-upload-plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
