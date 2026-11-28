# YKP UI Redesign — M0 (Fondasi) + M1 (Hub) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terapkan identitas merah-hitam YKP (`#E01020`/`#101010`) di Hub dan scaffold auth Google+PIN di balik feature-flag, tanpa merusak login/SSO/API yang ada.

**Architecture:** Token-first. Tambah token brand di `globals.css` + `tailwind.config.js`, remap aksen lama di komponen Hub ke token brand. Logika auth baru (Google/PIN) diisolasi di helper murni + route stub yang balas `501 disabled` saat flag OFF. Visibilitas modul per peran dibuat sebagai helper murni dengan default "semua" (identity) agar tidak mengunci akses.

**Tech Stack:** Next.js 14 (App Router), React 18, Tailwind 3, TypeScript 5. Test: `node --test` (Node 23 type-stripping) + `tsc --noEmit` + `next build`.

**Spec:** `docs/superpowers/specs/2026-11-28-ykp-ui-redesign-design.md`

## Global Constraints

- Brand merah `#E01020` → HSL `355 85% 47%`. Ink `#101010` → HSL `0 0% 6%`. Putih surface `0 0% 100%`.
- **Non-breaking:** hanya ubah token/visual di app lama. JANGAN ubah `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, nama/format cookie `ykp_hub_session`, atau backend/DB. Perubahan API satu-satunya = route stub baru `/api/auth/google` + `/api/auth/pin` (aditif, flag default OFF).
- **Feature-flag default OFF:** `YKP_AUTH_GOOGLE_ENABLED` / `YKP_AUTH_PIN_ENABLED` (server) dan `NEXT_PUBLIC_YKP_AUTH_GOOGLE_ENABLED` (client). Absen/!= "1" berarti OFF.
- **Tanpa dependency baru** di `ykp-hub`.
- **Marketing JANGAN ditambahkan ke `HUB_MODULES` di M1.** Menambah modul ke-7 sekarang butuh env build-time wajib baru (`requiredUrl`) dan akan memutus build yang ada (melanggar guardrail spec §3). Modul Marketing ditambahkan di rencana M3 dengan pola URL opsional.
- **NO COMMITS.** Sesuai aturan proyek: jangan commit kecuali diminta. Akhiri tiap task dengan verifikasi dan biarkan perubahan di working tree.
- Verifikasi Hub (tidak ada ESLint config): `npx tsc --noEmit`, `node --test tests/*.node-check.mjs`, `node tests/use-health.node-check.cjs`, dan `next build` dengan env dummy (lihat Perintah Verifikasi).

## Perintah Verifikasi (Hub)

```bash
# 1. Type check
npx tsc --noEmit

# 2. Unit checks (Node type-stripping)
node --test tests/*.node-check.mjs
node tests/use-health.node-check.cjs

# 3. Build (env dummy agar requiredUrl terpenuhi; tidak menyentuh data nyata)
NEXT_PUBLIC_YKP_OWNER_URL=http://127.0.0.1:1 \
NEXT_PUBLIC_YKP_HR_URL=http://127.0.0.1:1 \
NEXT_PUBLIC_YKP_FINANCE_URL=http://127.0.0.1:1 \
NEXT_PUBLIC_YKP_WAREHOUSE_URL=http://127.0.0.1:1 \
NEXT_PUBLIC_YKP_INVESTOR_URL=http://127.0.0.1:1 \
NEXT_PUBLIC_YKP_OPS_URL=http://127.0.0.1:1 \
HUB_SESSION_SECRET=0123456789abcdef0123456789abcdef \
npx next build
```
Expected: tsc exit 0; semua `node --test`/node-check `ALL_PASS`/`pass`; `next build` sukses ("Compiled successfully").

## Review Focus (failure modes paling mungkin menggigit)

1. **Build tanpa env** → `requiredUrl` di `config.ts` melempar saat import. Plan ini TIDAK menambah env wajib dan TIDAK mengubah `config.ts`. Test: §Perintah Verifikasi build dengan env dummy.
2. **Login regresi** → `POST /api/auth/login` + form harus tetap berfungsi. Test: `login-form.tsx` tetap memanggil `onLogin(username, password)`; route login tidak diubah.
3. **Auth flag tak sengaja aktif** → default harus OFF. Test: `tests/auth-flags.node-check.mjs` default false.
4. **Modul terkunci untuk peran** → `visibleApps` default "semua". Test: semua peran mengembalikan seluruh daftar saat map kosong.
5. **Aksen lama tertinggal / token melenceng** → nilai token harus persis spec; tidak ada `from-blue-500/to-indigo-600/...` di `apps.ts`. Test: `tests/brand-tokens.node-check.mjs`.

---

### Task 1: Design tokens (M0 fondasi)

**Files:**
- Modify: `ykp-hub/app/globals.css` (tambah blok `:root` brand + utility)
- Modify: `ykp-hub/tailwind.config.js` (extend `colors` + `borderRadius`)
- Test: `ykp-hub/tests/brand-tokens.node-check.mjs`

**Interfaces:**
- Produces: CSS custom properties `--brand`, `--brand-fg`, `--brand-strong`, `--brand-soft`, `--ink`; Tailwind colors `brand.{DEFAULT,fg,strong,soft}` dan `ink`.

- [ ] **Step 1: Tulis test yang gagal** — `ykp-hub/tests/brand-tokens.node-check.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const tw = fs.readFileSync(new URL("../tailwind.config.js", import.meta.url), "utf8");
test("brand token values are exact", () => {
  assert.match(css, /--brand:\s*355 85% 47%/);
  assert.match(css, /--ink:\s*0 0% 6%/);
  assert.match(css, /--brand-fg:/);
  assert.match(css, /--brand-strong:/);
  assert.match(css, /--brand-soft:/);
});
test("tailwind exposes brand + ink", () => {
  assert.match(tw, /brand/);
  assert.match(tw, /ink/);
});
```
- [ ] **Step 2: Jalankan test, pastikan GAGAL** — `node --test tests/brand-tokens.node-check.mjs` → FAIL (`--brand` tidak ditemukan).
- [ ] **Step 3: Implementasi** — tambahkan ke `globals.css` (di dalam `:root`, atau blok baru setelahnya):
```css
:root{
  --brand:355 85% 47%; --brand-fg:0 0% 100%;
  --brand-strong:354 92% 36%; --brand-soft:356 90% 96%;
  --ink:0 0% 6%;
}
```
Tambahkan utility: `.bg-brand{background:hsl(var(--brand))}`, `.text-brand{color:hsl(var(--brand))}`, `.ring-brand{--tw-ring-color:hsl(var(--brand))}`, `.gradient-brand{background-image:linear-gradient(135deg,hsl(var(--brand)),hsl(var(--brand-strong)))}`.
Di `tailwind.config.js` `theme.extend` tambahkan:
```js
colors:{ brand:{DEFAULT:"hsl(355 85% 47%)",fg:"hsl(0 0% 100%)",strong:"hsl(354 92% 36%)",soft:"hsl(356 90% 96%)"}, ink:"hsl(0 0% 6%)" },
borderRadius:{ xl2:"1rem" }
```
- [ ] **Step 4: Jalankan test, pastikan LULUS** — `node --test tests/brand-tokens.node-check.mjs` → PASS. Lalu `npx tsc --noEmit` → exit 0.
- [ ] **Step 5: Verifikasi build** — jalankan perintah `next build` dengan env dummy (§Perintah Verifikasi) → sukses.

---

### Task 2: Auth flag helper + route stub Google/PIN

**Files:**
- Create: `ykp-hub/app/lib/auth-flags.ts`
- Create: `ykp-hub/app/api/auth/google/route.ts`
- Create: `ykp-hub/app/api/auth/pin/route.ts`
- Test: `ykp-hub/tests/auth-flags.node-check.mjs`

**Interfaces:**
- Produces: `isGoogleAuthEnabled(): boolean`, `isPinAuthEnabled(): boolean`, `isGoogleAuthEnabledClient(): boolean`.
- Consumes (route): `../../../lib/auth-flags`.

- [ ] **Step 1: Tulis test gagal** — `ykp-hub/tests/auth-flags.node-check.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isGoogleAuthEnabled, isPinAuthEnabled, isGoogleAuthEnabledClient } from "../app/lib/auth-flags.ts";
test("off by default", () => {
  delete process.env.YKP_AUTH_GOOGLE_ENABLED;
  delete process.env.YKP_AUTH_PIN_ENABLED;
  delete process.env.NEXT_PUBLIC_YKP_AUTH_GOOGLE_ENABLED;
  assert.equal(isGoogleAuthEnabled(), false);
  assert.equal(isPinAuthEnabled(), false);
  assert.equal(isGoogleAuthEnabledClient(), false);
});
test("on when 1", () => {
  process.env.YKP_AUTH_GOOGLE_ENABLED = "1";
  process.env.YKP_AUTH_PIN_ENABLED = "1";
  process.env.NEXT_PUBLIC_YKP_AUTH_GOOGLE_ENABLED = "1";
  assert.equal(isGoogleAuthEnabled(), true);
  assert.equal(isPinAuthEnabled(), true);
  assert.equal(isGoogleAuthEnabledClient(), true);
});
```
- [ ] **Step 2: Jalankan, pastikan GAGAL** — `node --test tests/auth-flags.node-check.mjs` → FAIL (modul tidak ada).
- [ ] **Step 3: Implementasi helper** — `app/lib/auth-flags.ts`
```ts
export function isGoogleAuthEnabled(): boolean { return process.env.YKP_AUTH_GOOGLE_ENABLED === "1"; }
export function isPinAuthEnabled(): boolean { return process.env.YKP_AUTH_PIN_ENABLED === "1"; }
export function isGoogleAuthEnabledClient(): boolean { return process.env.NEXT_PUBLIC_YKP_AUTH_GOOGLE_ENABLED === "1"; }
```
- [ ] **Step 4: Implementasi route stub** — `app/api/auth/google/route.ts`
```ts
import { NextResponse } from "next/server";
import { isGoogleAuthEnabled } from "../../../lib/auth-flags";
export async function POST() {
  if (!isGoogleAuthEnabled()) {
    return NextResponse.json({ error: { code: "disabled", message: "Google login belum diaktifkan" } }, { status: 501 });
  }
  return NextResponse.json({ error: { code: "not_implemented", message: "Google OAuth belum dikonfigurasi" } }, { status: 501 });
}
```
`app/api/auth/pin/route.ts` sama polanya memakai `isPinAuthEnabled()` (code `disabled`/`not_implemented`).
- [ ] **Step 5: Jalankan test, pastikan LULUS** — `node --test tests/auth-flags.node-check.mjs` → PASS; `npx tsc --noEmit` → exit 0.
- [ ] **Step 6: Verifikasi build** → `next build` (env dummy) sukses (route baru ter-compile).

---

### Task 3: Role-based module visibility (helper murni + wire Dashboard)

**Files:**
- Create: `ykp-hub/app/components/role-modules.ts`
- Create: `ykp-hub/tests/role-modules.node-check.mjs`
- Modify: `ykp-hub/app/components/dashboard.tsx` (pakai `visibleApps`)

**Interfaces:**
- Produces: `visibleApps<T extends { id: string }>(apps: readonly T[], role: string): T[]`.
- Consumes: dipanggil di `dashboard.tsx`.

- [ ] **Step 1: Tulis test gagal** — `ykp-hub/tests/role-modules.node-check.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleApps } from "../app/components/role-modules.ts";
const apps = [{ id: "owner" }, { id: "hr" }, { id: "finance" }];
test("default (map kosong) shows all, does not mutate", () => {
  const out = visibleApps(apps, "EMPLOYEE");
  assert.deepEqual(out.map(a => a.id), ["owner", "hr", "finance"]);
  assert.notEqual(out, apps);
});
test("unknown role shows all", () => {
  assert.deepEqual(visibleApps(apps, "WHATEVER").map(a => a.id), ["owner", "hr", "finance"]);
});
test("explicit allowlist filters", () => {
  const map = { hr: ["hr"] };
  assert.deepEqual(visibleApps(apps, "hr", map).map(a => a.id), ["hr"]);
});
```
- [ ] **Step 2: Jalankan, pastikan GAGAL** — `node --test tests/role-modules.node-check.mjs` → FAIL.
- [ ] **Step 3: Implementasi** — `app/components/role-modules.ts`
```ts
export type RoleModuleMap = Record<string, readonly string[] | "ALL">;
// Kosong = semua peran melihat semua modul (perilaku saat ini, non-breaking).
export const ROLE_MODULES: RoleModuleMap = {};
export function visibleApps<T extends { id: string }>(apps: readonly T[], role: string, map: RoleModuleMap = ROLE_MODULES): T[] {
  const allow = map[(role ?? "").toUpperCase()] ?? "ALL";
  if (allow === "ALL") return [...apps];
  return apps.filter((a) => allow.includes(a.id));
}
```
- [ ] **Step 4: Jalankan test, pastikan LULUS** — `node --test tests/role-modules.node-check.mjs` → PASS.
- [ ] **Step 5: Wire Dashboard** — di `dashboard.tsx`: import `visibleApps`; lalu `const apps = visibleApps(props.apps, session.role);` dan ganti pemakaian `props.apps` pada grid `ModuleCard`, `<StatusList apps=…>`, dan `<Footer apps=…>` menjadi `apps`. Tidak mengubah props/komponen lain.
- [ ] **Step 6: Verifikasi** — `npx tsc --noEmit` exit 0; `node --test tests/*.node-check.mjs` lulus; `next build` (env dummy) sukses.

---

### Task 4: Module tones → brand family (`apps.ts`) + guard konsistensi

**Files:**
- Modify: `ykp-hub/app/components/apps.ts` (blok `PRESENTATION` `tone`)
- Modify: `ykp-hub/tests/brand-tokens.node-check.mjs` (tambah guard `apps.ts`)
- (Ikon tetap.)

**Interfaces:**
- Produces: `AppDef["tone"]` tetap berbentuk `{gradient,text,ring,soft}` — nilainya brand family. Kontrak `AppDef` tidak berubah.

- [ ] **Step 1: Tambah test gagal** — sisipkan di `tests/brand-tokens.node-check.mjs`
```js
test("apps.ts has no legacy accent gradients", () => {
  const apps = fs.readFileSync(new URL("../app/components/apps.ts", import.meta.url), "utf8");
  assert.doesNotMatch(apps, /from-blue-500|to-indigo-600|from-emerald-5|to-emerald-7|from-amber-|from-purple-|from-orange-/);
  assert.match(apps, /E01020|brand/i);
});
```
- [ ] **Step 2: Jalankan, pastikan GAGAL** — `node --test tests/brand-tokens.node-check.mjs` → FAIL pada guard baru.
- [ ] **Step 3: Implementasi** — ganti tiap `tone` di `PRESENTATION` (owner/hr/finance/warehouse/investor/ops) menjadi brand family, mis.:
```ts
tone: { gradient: "from-[#E01020] to-[#9c0b16]", text: "text-[#E01020] dark:text-red-400", ring: "ring-red-200 dark:ring-red-900", soft: "bg-red-50 dark:bg-red-900/30" }
```
Boleh variasi tipis per modul asalkan tetap dalam keluarga merah (tidak memakai blue/indigo/emerald/purple/amber/orange).
- [ ] **Step 4: Jalankan test, pastikan LULUS** — `node --test tests/brand-tokens.node-check.mjs` → PASS; `npx tsc --noEmit` exit 0.

---

### Task 5: Login reskin sesuai `01 / YKP Hub`

**Files:**
- Modify: `ykp-hub/app/components/login-form.tsx`
- Modify: `ykp-hub/tests/brand-tokens.node-check.mjs` (tambah guard copy login)

**Interfaces:**
- Produces: `LoginForm` tetap menerima `{ onLogin: (username: string, password: string) => Promise<void> }` (TIDAK berubah — `page.tsx` tidak diubah). Form tetap memanggil `onLogin(username, password)`.

- [ ] **Step 1: Tambah test gagal** — sisipkan di `tests/brand-tokens.node-check.mjs`
```js
test("login-form keeps reference copy", () => {
  const f = fs.readFileSync(new URL("../app/components/login-form.tsx", import.meta.url), "utf8");
  assert.match(f, /SATU AKUN UNTUK RUANG KERJA YKP/);
  assert.match(f, /Simulasikan login Google/);
  assert.match(f, /onLogin\(/);
  assert.match(f, /isGoogleAuthEnabledClient/);
});
```
- [ ] **Step 2: Jalankan, pastikan GAGAL** — `node --test tests/brand-tokens.node-check.mjs` → FAIL.
- [ ] **Step 3: Implementasi layout reskin** — ubah `login-form.tsx` menjadi dua kolom: **hero merah** (kiri, latar `bg-brand`/`gradient-brand`, teks putih) berisi `SATU AKUN UNTUK RUANG KERJA YKP` + `ORKESTRASI SISTEM · RUANG KERJA YKP`; **kartu** (kanan) berisi langkah `01 Akun Google`, paragraf *"Coba alur masuk melalui Google, lalu konfirmasi dengan PIN untuk membuka modul sesuai peran."*, tombol `Simulasikan login Google ›`, pemisah, lalu **form username/password** (input + tombol "Masuk") yang memanggil `onLogin`. Import `isGoogleAuthEnabledClient` dari `../lib/auth-flags`.
  - Flag OFF (default): tombol Google `type="button"` hanya fokus ke input username (tidak memalsukan login) + helper "Google login belum aktif — gunakan akun YKP."
  - Flag ON: tombol Google `fetch("/api/auth/google",{method:"POST"})` (stub 501 tetap tampil pesan beradab).
  - Ganti semua `blue-*`/`indigo-*` yang tersisa dengan token brand. Pertahankan state busy/error yang sudah ada.
- [ ] **Step 4: Jalankan test, pastikan LULUS** — `node --test tests/brand-tokens.node-check.mjs` → PASS; `npx tsc --noEmit` exit 0.
- [ ] **Step 5: Verifikasi build** → `next build` (env dummy) sukses.

---

### Task 6: Dashboard header reskin (logo/aksen brand)

**Files:**
- Modify: `ykp-hub/app/components/dashboard.tsx`

- [ ] **Step 1: Implementasi** — ganti logo header `bg-gradient-to-br from-blue-500 to-indigo-600` → `gradient-brand` (atau `bg-brand`); ganti hover link biru (`hover:text-blue-600 dark:hover:text-blue-400`) → `hover:text-[#E01020] dark:hover:text-red-400`; ganti aksen biru lain di header dengan brand. **Pertahankan** neutral slate untuk teks/border (sesuai referensi ink/putih).
- [ ] **Step 2: Verifikasi** — `npx tsc --noEmit` exit 0; `node --test tests/*.node-check.mjs` lulus; `next build` (env dummy) sukses.
- [ ] **Step 3: Guard regresi visual** — `grep -nE "blue-|indigo-" app/components/dashboard.tsx` → kosong (kecuali status info yang disengaja; jika ada `text-blue-` untuk status, ganti ke token netral/brand). Dokumentasikan hasil di ringkasan task.

---

### Task 7: Verifikasi akhir M1 + artefak screenshot

**Files:** (tidak ada perubahan kode; hanya verifikasi)

- [ ] **Step 1: Type check** — `npx tsc --noEmit` → exit 0.
- [ ] **Step 2: Unit checks** — `node --test tests/*.node-check.mjs` → semua pass; `node tests/use-health.node-check.cjs` → `ALL_PASS`.
- [ ] **Step 3: Build** — jalankan `next build` dengan env dummy (§Perintah Verifikasi) → "Compiled successfully".
- [ ] **Step 4: Artefak visual (untuk sign-off user)** — jalankan `next dev -p 3000` dengan env dummy di background, lalu ambil screenshot halaman login & dashboard memakai Playwright (mis. `npx playwright screenshot http://localhost:3000 /tmp/ykp-login.png`) dan simpan ke `docs/superpowers/artifacts/`. Agent TIDAK menilai estetika; user membandingkan dengan referensi.
- [ ] **Step 5: Ringkas** — laporkan: file diubah, hasil verifikasi (tsc/test/build), dan catatan bahwa Marketing ditunda ke M3 (guardrail env).

---

## Self-Review

- **Spec coverage (M0+M1):** §4 token (Task 1,4); §5.1 login reskin (Task 5); §5.2 auth scaffold (Task 2); §5.3 dashboard + role (Task 3,6). §5.3 marketing module-card → sengaja ditunda ke M3 (dicatat di Global Constraints, alasan guardrail env). §6–§8 = milestone lain (rencana terpisah).
- **Step scan:** tiap step satu aksi dengan hasil terukur; tidak ada "handle edge cases"/TBD.
- **Type consistency:** `visibleApps`, `isGoogleAuthEnabled*`, `AppDef["tone"]` konsisten antar task.
- **Review Focus:** tiap butir punya test di task pemilik (Task 1/2/3/4/5).
- **Proportion:** plan memuat signature + assertion, bukan transkrip kode penuh.

## Catatan Deviasi Spec

Spec §5.3 menyebut menambah Marketing sebagai modul ke-7. Ditunda ke rencana M3 karena menambah modul ke `HUB_MODULES` kini menuntut env build-time wajib baru (`NEXT_PUBLIC_YKP_MARKETING_URL` via `requiredUrl`) yang akan **memutus build existing** — bertentangan dengan guardrail non-breaking §3. M3 akan menambahkannya dengan pola URL opsional (filtrasi modul yang tak punya URL).
