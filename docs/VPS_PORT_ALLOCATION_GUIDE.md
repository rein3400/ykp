# YKP ERP & VPS Multi-Project Guide

## VPS Specs & Info
- **Host / IP**: `187.52.124.40`
- **Location**: Jakarta, Indonesia
- **OS**: Ubuntu 24.04 LTS
- **User**: `dev` (sudo available)
- **Node.js**: `v20.20.2` via NVM (`/home/dev/.nvm/versions/node/v20.20.2/bin`)
- **Process Manager**: PM2 (running under user `dev`)
- **Reverse Proxy**: Caddy (`/etc/caddy/Caddyfile`)
- **Isolation Root**: `/home/dev/ykp` (Semua file dan project YKP terlokalisasi rapi di folder ini)

---

## Port Allocation Matrix

### YKP Ecosystem (Ports 3000 - 3010)
| Port | App Name | PM2 Name | Path | Deskripsi |
|---|---|---|---|---|
| `3000` | Hub Launcher | `ykp-hub` | `/home/dev/ykp/ykp-hub` | Portal utama SSO & launcher seluruh app |
| `3002` | HR ERP | `ykp-hr` | `/home/dev/ykp/ykp-erp/apps/hr` | ERP HR (PostgreSQL) |
| `3003` | Finance ERP | `ykp-finance` | `/home/dev/ykp/ykp-erp/apps/finance` | ERP Finance (PostgreSQL) |
| `3004` | Hermez ERP | `ykp-hermez` | `/home/dev/ykp/ykp-erp/apps/hermez` | ERP Hermez AI Command |
| `3005` | Warehouse Sheets | `ykp-warehouse` | `/home/dev/ykp/ykp-warehouse-v1` | Gudang (Google Sheets) |
| `3006` | Investor Sheets | `ykp-investor` | `/home/dev/ykp/ykp-investor-v1` | Investor Portal (Google Sheets) |
| `3007` | Ops Sheets | `ykp-ops` | `/home/dev/ykp/ykp-operational-v1` | Operasional Outlet (Google Sheets) |
| `3008` | HR-v1 Sheets | `ykp-hr-v1` | `/home/dev/ykp/ykp-hr-v1` | HR Pilot (Google Sheets + Telegram Absen) |
| `3009` | Finance-v1 Sheets | `ykp-finance-v1` | `/home/dev/ykp/ykp-finance-v1` | Finance V1 (Google Sheets URL Importer) |
| `3010` | Owner Command | `ykp-owner-v1` | `/home/dev/ykp/ykp-owner-v1` | Owner Cross-Module Visibility Dashboard |

### Shared Services
| Port | Service | Notes |
|---|---|---|
| `80` | Caddy | Reverse proxy gateway |
| `5432` | PostgreSQL 17 | Docker container `ykp-postgres` (Internal ERP DB) |
| `6379` | Redis 7 | Docker container `ykp-redis` (Internal ERP cache/queue) |

---

## Aturan Isolasi untuk Projek Lain (Non-YKP)

1. **Direktori**: Letakkan projek lain di folder terpisah di luar `/home/dev/ykp` (contoh: `/home/dev/project-b`, `/home/dev/myapp`, dsb).
2. **Port Allocation**: Gunakan port di luar range YKP:
   - Port yang aman digunakan: `4000-4999`, `5000-5999`, atau `8000-8999`.
3. **PM2 Naming**: Beri prefix nama aplikasi sesuai projek (contoh: `projb-api`, `projb-web`), sehingga tidak tumpang tindih dengan namespace `ykp-*`.
4. **Caddy Gateway**: Tambahkan domain / subdomain baru di `/etc/caddy/Caddyfile`:
   ```caddy
   app.domain-lain.com {
       reverse_proxy localhost:4000
   }
   ```
   Lalu jalankan `sudo systemctl reload caddy`.
