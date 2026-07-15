# Deployment Models — YKP ERP (4 Apps → 1 Hub?)

Pertanyaan user: "Trus nyatuinnya gimana?"

## Context

Saat ini 4 apps deployed di Railway:
- `ykp-erp-finance-production.up.railway.app` (port 3003, Postgres)
- `ykp-erp-hermez-production.up.railway.app` (port 3004, Postgres)
- `ykp-erp-hr-production.up.railway.app` (port 3002, Postgres)
- `ykp-hr-v1-production.up.railway.app` (port 3002, Google Sheets — pilot)

Plus legacy Vercel (broken builds).

User concern: 4 link kebanyakan. Mau tau cara nyatuin.

---

## Model A — Tetap 4 link, unified auth + dashboard hub

Setiap app tetap berdiri sendiri, tapi:
- Single Sign-On (SSO) — 1 login, akses ke 4 apps
- Dashboard hub di `app.ykp.com` dengan 4 card link ke masing-masing app
- API gateway yang ngatur routing

### Implementasi konkret
1. **Subdomain per app**: `finance.ykp.com`, `hr.ykp.com`, `hermez.ykp.com`, `pilot.ykp.com`
2. **Shared auth** — token JWT yang valid di semua app (same `NEXTAUTH_SECRET` di semua service)
3. **Hub page** static HTML di `app.ykp.com` dengan 4 button → redirect ke subdomain masing-masing
4. **Hermez jadi aggregator** — baca dari finance/hr/ops API endpoints, tampilkan summary unified

### Kelebihan
- ✅ Isolation tetap (bug 1 app gak affect lain)
- ✅ Independent deploy
- ✅ Clear ownership per tim
- ✅ Sesuai arsitektur brief (HR/Finance/Hermez = 3 modul terpisah)

### Kekurangan
- ❌ 4 URL berbeda (lo bilang kebanyakan)
- ❌ Cookie sharing butuh config lintas domain

---

## Model B — 1 Link, 4 Module (full consolidate)

Merge jadi 1 Next.js app dengan 4 route group + middleware-based routing:
- `/finance/*` → finance routes
- `/hr/*` → hr routes
- `/hermez/*` → hermez routes
- `/hr-v1/*` → pilot routes

Single codebase, single deploy, single URL.

### Implementasi konkret
1. Refactor `ykp-erp` monorepo jadi 1 Next.js app dengan parallel routes
2. Move `ykp-hr-v1` code ke `ykp-erp/apps/hub` (atau root)
3. Single Dockerfile, single service di Railway
4. URL: `https://ykp-hub-production.up.railway.app`

### Kelebihan
- ✅ 1 URL, simple buat user
- ✅ Single deploy pipeline
- ✅ Shared components, less duplication
- ✅ Cookie/auth shared otomatis

### Kekurangan
- ❌ Bundle size gede (4 app in 1)
- ❌ Bug 1 module = downtime semua
- ❌ Sheets pilot break production Postgres (different DB)
- ❌ Big refactor effort
- ❌ Brief explicitly pisahkan modul (lihat brief §1-§7)

---

## Model C — Hybrid (Rekomendasi)

3 production apps tetap (finance/hermez/hr-v2) + 1 pilot (hr-v1) digabung jadi 1 "Operations Hub"

Struktur:
```
ykp-hub.ykp.com/
├── /finance/         → finance routes
├── /hr/             → hr production routes
├── /hermez/         → AI Command Center
├── /hr-v1/          → pilot (Sheets)
└── /                → hub/dashboard
```

Plus:
- Production: finance, hermez, hr (Postgres) — semua di 1 app
- Pilot: hr-v1 (Sheets) — di 1 app, prefix `/hr-v1/`
- Shared: middleware handles DB switching (Sheets for `/hr-v1/*`, Postgres for rest)

### Implementasi konkret
1. Gabungkan `ykp-erp/apps/{finance,hermez,hr}` → 1 Next.js app
2. Add `ykp-hr-v1` as `/hr-v1/` routes in same app
3. Middleware: detect route prefix, set DB client accordingly
4. Single Dockerfile, single Railway service
5. Single URL: `https://ykp-hub-production.up.railway.app`

### Kelebihan
- ✅ 1 URL (user concern solved)
- ✅ Pilot isolated by route prefix
- ✅ Shared auth/components
- ✅ Easier to maintain

### Kekurangan
- ⚠️ 2 DB engines in 1 app (Postgres + Sheets) — middle complexity
- ⚠️ Bigger bundle, slower cold start
- ⚠️ Migration effort moderate (combine 4 → 1 Next.js app)

---

## Comparison Table

| Aspect | Model A (4 link) | Model B (full consolidate) | Model C (hybrid) |
|---|---|---|---|
| URL count | 4 | 1 | 1 |
| Deploy units | 4 services | 1 service | 1 service |
| Pilot isolation | Full (separate app) | None (same app) | Partial (route prefix) |
| DB engines | 2 (Postgres + Sheets) | 2 (Postgres + Sheets) | 2 (Postgres + Sheets) |
| Bundle size | Normal (4 separate) | Big (4 in 1) | Medium (3 prod + 1 pilot) |
| Refactor effort | Low | High | Medium |
| Failure isolation | Strong | Weak | Medium |
| Brief alignment | High (4 modules) | Low (1 app) | High (route prefix preserves modules) |
| Cookie/auth | Per-app (separate) | Shared | Shared |

---

## Rekomendasi: Model C (Hybrid)

Kenapa:
- User concern "4 link kebanyakan" — solved dengan 1 URL
- Brief tetap pisahkan modules — preserved by route prefix
- Pilot isolation (hr-v1) tetap jalan terpisah secara logic — preserved by middleware DB switching
- Effort: moderate (vs full rewrite di Model B)
- Risk: low (gradual migration, bisa keep old deploys running)

Trade-off:
- Bundle size naik ~2x (4 app in 1)
- Initial load slower
- Untuk admin dashboard use case, acceptable

---

## Next Steps (kalau Model C dipilih)

1. Phase 0: Plan refactor (struktur folder + middleware DB switching)
2. Phase 1: Setup 1 Next.js app di `ykp-erp/apps/hub`
3. Phase 2: Move finance/hermez/hr routes ke hub
4. Phase 3: Move hr-v1 routes ke hub (with Sheets adapter)
5. Phase 4: Add middleware untuk DB routing
6. Phase 5: Test + deploy sebagai 1 service

Estimasi effort: 1-2 hari refactor + testing.

Status: plan file exists, exit pending.