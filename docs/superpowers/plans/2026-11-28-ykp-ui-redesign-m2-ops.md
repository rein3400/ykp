# YKP UI Redesign — M2 (Operasional) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin app Operasional (`ykp-ops-v1`) ke identitas merah-hitam YKP dan bingkai Opening/Closing sebagai "Draf SOP" sesuai referensi (`03 / Operasional`), tanpa mengubah API/logika data.

**Architecture:** Token-first. Tambah token brand di `globals.css` + `tailwind.config.ts`, remap aksen interaktif emerald → brand di `opening-client`/`closing-client` (warna status sukses tetap hijau). Komponen `DraftSopBanner` presentasional + header halaman. Divisi grouping sudah ada (`department`) — dipertahankan. Tidak menyentuh route API, `db/sheets.ts`, atau kontrak data.

**Tech Stack:** Next.js (App Router), React, Tailwind 3, TypeScript, Vitest (`environment: node`, render via `react-dom/server`), oxlint.

**Spec:** `docs/superpowers/specs/2026-11-28-ykp-ui-redesign-design.md` (§6)

## Global Constraints
- **Non-breaking:** jangan ubah `src/app/api/**`, `src/db/sheets.ts`, `src/lib/**` kontrak, atau struktur data. Perubahan = visual + prop opsional (`picName`) + komponen baru.
- Token brand: `--brand: 355 85% 47%` (#E01020), `--ink: 0 0% 6%` (#101010).
- Warna **status sukses** (DONE/selesai/approved) tetap hijau; hanya aksen interaktif (progress, focus, checkbox, tombol utama) → brand.
- **Tanpa dependency baru.**
- **NO COMMITS** (aturan proyek). Akhiri tiap task dengan verifikasi.
- Verifikasi: `npx oxlint`, `npx vitest run`, `npx next build` (env bila perlu).

## Review Focus
1. API/logika tak berubah → `git diff` pada `src/app/api/**`, `src/db/**`, `src/lib/**` harus kosong.
2. Status sukses tidak berubah jadi merah (DONE tetap hijau) — test render memuat kelas hijau & brand terpisah.
3. Divisi grouping tetap tampil (FOH/Kitchen/Kasir) — test render memuat nama divisi.
4. PIC & label "Sebelum buka/tutup" muncul hanya saat data tersedia — test prop `picName`.
5. Build tetap hijau tanpa env (halaman `force-dynamic`) — `next build`.

---

### Task 1: Brand tokens (ops)

**Files:** Modify `src/app/globals.css`, `src/tailwind`→`tailwind.config.ts`; Test `src/app/brand-tokens.test.ts`

- [ ] **Step 1: test gagal** — `src/app/brand-tokens.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(__dirname, '../../');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
describe('brand tokens', () => {
  it('defines exact brand/ink CSS tokens', () => {
    const css = read('src/app/globals.css');
    expect(css).toMatch(/--brand:\s*355 85% 47%/);
    expect(css).toMatch(/--ink:\s*0 0% 6%/);
    expect(css).toMatch(/--brand-strong:/);
  });
  it('exposes brand + ink in tailwind', () => {
    const tw = read('tailwind.config.ts');
    expect(tw).toMatch(/brand/);
    expect(tw).toMatch(/ink/);
  });
});
```
- [ ] **Step 2: run → FAIL.**
- [ ] **Step 3: implement** — `globals.css` tambah:
```css
:root{--brand:355 85% 47%;--brand-fg:0 0% 100%;--brand-strong:354 92% 36%;--ink:0 0% 6%;}
.gradient-brand{background-image:linear-gradient(135deg,hsl(var(--brand)),hsl(var(--brand-strong)));}
.bg-brand{background-color:hsl(var(--brand));}.text-brand{color:hsl(var(--brand));}
```
`tailwind.config.ts` `theme.extend` tambah `colors.brand{DEFAULT:"hsl(355 85% 47%)",strong:"hsl(354 92% 36%)",fg:"hsl(0 0% 100%)"}, colors.ink:"hsl(0 0% 6%)"`.
- [ ] **Step 4: run → PASS + `npx oxlint`.**

### Task 2: DraftSopBanner + page headers

**Files:** Create `src/components/draft-sop-banner.tsx`, test `src/components/draft-sop-banner.test.tsx`; Modify `src/app/ops/opening/page.tsx`, `src/app/ops/closing/page.tsx`.

**Interfaces:** `DraftSopBanner({ context?: string })` renders badge "Draf SOP" + disclaimer. Pages pass `context` = `<brand?> - <outlet?>` if available else nothing; pages add badge line + `<DraftSopBanner/>` under the H1. Pages also pass `picName={session.username}` to clients.

- [ ] **Step 1: test gagal** — assert render contains `Draf SOP` and `SOP resmi tiap brand/outlet belum dilampirkan`, and `Draf untuk X` when context="X".
- [ ] **Step 2: run → FAIL.**
- [ ] **Step 3: implement component + wire pages** (keep breadcrumb/H1/subtitle; add small badge and banner).
- [ ] **Step 4: run → PASS + oxlint.**

### Task 3: OpeningClient reskin + PIC + "Sebelum buka" + legacy note

**Files:** Modify `src/app/ops/opening/opening-client.tsx`, extend `src/app/ops/opening/opening-client.test.ts`; prop `picName?: string`.

- [ ] **Step 1: extend test** — assert html contains `#E01020` (brand accent), `PIC checklist: Sari` when `picName='Sari'`, and `Sebelum buka`.
- [ ] **Step 2: run → FAIL.**
- [ ] **Step 3: implement** — accent emerald→brand on interactive only (progress fill `bg-emerald-600`→`bg-[#E01020]`, percent `text-emerald-700`→`text-[#E01020]`, `focus:border-emerald-600 focus:ring-emerald-600/20`→`focus:border-[#E01020] focus:ring-[#E01020]/20`, `accent-emerald-600`→`accent-[#E01020]`, `focus-visible:outline-emerald-600`→`focus-visible:outline-[#E01020]`), keep `bg-emerald-50/40`,`border-emerald-100`,`text-emerald-900`. Add PIC line in top card; append `· Sebelum buka` in dept header; compute `legacyCount = rows.filter(r=>!r.department).length` and show `· Riwayat lama tanpa divisi ({legacyCount})` in history heading when >0. Primary submit/QuickAdd `bg-slate-900`→`bg-[#E01020] hover:bg-[#9c0b16]`.
- [ ] **Step 4: run → PASS + oxlint.**

### Task 4: ClosingClient reskin + PIC + "Sebelum tutup"

**Files:** Modify `src/app/ops/closing/closing-client.tsx`, extend `src/app/ops/closing/closing-client.test.ts`; prop `picName?: string`.

- [ ] **Step 1: extend test** — assert `#E01020`, `PIC checklist: Sari`, `Sebelum tutup`.
- [ ] **Step 2: run → FAIL.**
- [ ] **Step 3: implement** — accent emerald→brand (same selectors; keep success `bg-emerald-50`, `text-emerald-800`, `bg-emerald-50/40`, `text-emerald-900`); add PIC line; append `· Sebelum tutup` in dept header; submit `bg-slate-900`→brand.
- [ ] **Step 4: run → PASS + oxlint.**

### Task 5: Sidebar / layout / login accents

**Files:** Modify `src/components/sidebar.tsx`, `src/app/ops/layout.tsx`, `src/app/login/page.tsx`; extend `src/app/brand-tokens.test.ts` with legacy-accent guard on `layout.tsx` (`sky-`/`blue-`/`indigo-`).

- [ ] **Step 1: extend guard test** — `tailwind`/layout: assert `src/app/ops/layout.tsx` has no `sky-|blue-|indigo-`; sidebar brand title class present.
- [ ] **Step 2: run → FAIL.**
- [ ] **Step 3: implement** — layout skip-link `focus:bg-sky-700`→`focus:bg-[#E01020]`; sidebar brand dot/title `bg-[#E01020]` and hover `hover:bg-red-50`; login H1 accent or button brand (keep logic). 
- [ ] **Step 4: run → PASS + oxlint.**

### Task 6: Verify M2 + screenshot

- [ ] `npx oxlint`
- [ ] `npx vitest run` (full suite, semua hijau)
- [ ] `npx next build` (env dummy kalau perlu)
- [ ] (opsional) Playwright screenshot opening page → `docs/superpowers/artifacts/ykp-ops-opening.png` (untuk sign-off user).

## Self-Review
- Spec §6 tercakup: T1 token; T2 badge/banner; T3/T4 divisi+PIC+draft framing+accent; T5 shell. API/data/logic untouched (guard git diff). Review Focus tiap butir punya test.
- Deferred: brand/outlet date filter & "Mulai checklist" mekanik (butuh data/flow baru) — dicatat sebagai follow-up; fokus non-breaking.
