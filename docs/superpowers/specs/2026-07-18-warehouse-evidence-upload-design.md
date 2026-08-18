# Design: Warehouse Evidence Upload (Foto/Video)

> **Scope:** `ykp-warehouse-v1` receiving, stock issue, transfer, waste, and stock-count transactions.  
> **Date:** 2026-07-18  
> **Status:** approved for implementation

---

## Goal

Attach photo/video evidence to every warehouse transaction so physical quantities (e.g., 10 kg of chicken) can be verified against recorded values, preventing fraud and disputes.

---

## Current State

- Warehouse V1 has 37 Sheets tabs, 18 API routes, 18 pages, stock ledger, inventory engine, purchase recommendation, alerts, and actions.
- Transactions supported: receiving, stock issue, transfer, waste, stock count/opname, adjustment, purchase request.
- No built-in evidence field; users rely on notes only.

---

## Target State

### Transactions with evidence

All of these must accept `evidence_urls[]` (public Supabase Storage URLs) and store them in the appropriate row:

1. **Receiving** (`receiving`, `stock_receipt`) — foto invoice, barang, qty/timbangan.
2. **Stock Issue** (`stock_issue`) — foto barang keluar.
3. **Transfer Dispatch** (`transfer_out`) — foto barang sebelum dikirim.
4. **Transfer Receive** (`transfer_in`) — foto barang saat diterima.
5. **Waste** (`waste`) — foto barang rusak/buang.
6. **Stock Count / Opname** (`stock_count`) — foto barang yang dihitung.

Adjustment and purchase request can optionally include evidence later; V1 focuses on the 6 above.

### Schema additions

Add an `evidence_urls` column to the relevant Sheets tabs (or JSON column if using JSON storage):

| Tab | New Column | Format |
|---|---|---|
| `receiving` | `evidence_urls` | JSON array of public URLs |
| `stock_issue` | `evidence_urls` | JSON array |
| `transfer` | `evidence_urls` | JSON array (dispatch + receive may be separate columns) |
| `waste` | `evidence_urls` | JSON array |
| `stock_count` | `evidence_urls` | JSON array |

Because Google Sheets stores text, serialize as JSON string in the cell, or use a dedicated `evidence_log` tab keyed by `transaction_type` and `transaction_id`. **Recommendation:** use a dedicated `evidence_log` tab to avoid bloating transaction rows and to support multiple photos/videos per transaction.

**Dedicated `evidence_log` tab columns:**

| # | Column |
|---|---|
| 1 | `evidence_id` |
| 2 | `transaction_type` (receiving/stock_issue/transfer/waste/stock_count) |
| 3 | `transaction_id` |
| 4 | `file_url` |
| 5 | `file_path` (Supabase internal path) |
| 6 | `media_type` (image/video) |
| 7 | `recorded_by` |
| 8 | `recorded_at` |
| 9 | `notes` |

### Supabase Storage

- Bucket: `warehouse-evidence`
- Path: `warehouse/{transaction_type}/{transaction_id}/{random}.{ext}`
- Max file size: 50 MB per video, 10 MB per image.
- Allowed MIME types: image/jpeg, image/png, image/webp, video/mp4, video/webm.
- Compression: image resize to 1920px max; video left as-is (later can add compression).
- RLS policy: authenticated users can read; only users with `warehouse_admin` / `owner` / `outlet_manager` roles can write.

### UI/UX

- Each transaction form has a drag-drop or file-input section labeled **"Bukti Foto/Video"**.
- Preview thumbnails for images; video player for videos.
- Upload happens on form submission (not live) to keep Sheets writes atomic.
- Transaction list shows an icon/badge when evidence exists.
- Detail modal has a **"Lihat Bukti"** tab/section.
- Approval view shows evidence before approve/reject.

### API additions

- `POST /api/warehouse/{transaction}/evidence` — add evidence to a transaction (can be done independently of transaction creation).
- `GET /api/warehouse/{transaction}/[id]/evidence` — list evidence for a transaction.
- `DELETE /api/warehouse/evidence/[evidence_id]` — remove evidence (with audit).

For V1, evidence can be passed inline in the existing transaction POST bodies as `evidence_urls[]` to avoid a new endpoint. The upload is handled by a shared client component and the URL array is submitted with the form.

### Audit

- Every evidence upload/delete writes to `audit_log` tab: action, actor, transaction reference, file URL.
- Every transaction creation with evidence logs `transaction:created_with_evidence`.

### Testing

- Unit test: `parseEvidenceUrls` handles JSON string / empty / invalid.
- API test: create receiving with evidence_urls, read back, verify `evidence_log` tab has row.
- UI test: upload preview visible, form submits, evidence badge shown.
- tsc clean across warehouse.

---

## Out of Scope (V1)

- OCR / AI verification of evidence vs qty.
- Video compression or streaming optimization.
- Real-time camera capture in browser (file upload only).
- Evidence for purchase request and adjustment.

---

## Files to Touch (high-level)

- `ykp-warehouse-v1/src/db/sheets.ts` — add `EVIDENCE_LOG` tab headers + helpers.
- `ykp-warehouse-v1/src/lib/repo.ts` — helpers to write/read evidence.
- `ykp-warehouse-v1/src/lib/supabase.ts` — new Supabase Storage client.
- `ykp-warehouse-v1/src/lib/schemas.ts` — add `evidence_urls` to transaction schemas.
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
- `ykp-warehouse-v1/src/components/evidence-upload.tsx` — shared upload component.
- `ykp-warehouse-v1/src/components/evidence-gallery.tsx` — shared preview gallery.
- `ykp-warehouse-v1/scripts/bootstrap.ts` — add `evidence_log` tab.

---

## Risks

- **Sheets quota:** evidence URLs can be long; one transaction with 5 photos = 5 rows in `evidence_log`. Still within 60 writes/min for pilot scale.
- **Storage cost:** videos can be large. Add 50 MB limit and consider retention policy.
- **Mobile upload:** file input must work on mobile browsers; camera capture is fine if user picks "Take Photo".

---

## Approved By

User confirmed via chat: "execute" after design walkthrough.
