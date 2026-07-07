# YKP SRI ICT Silver Bullet — TradingView Pine Script (v2)

Indicator Pine Script v5 untuk sistem **YKP AI Orchestrator / Hermes**.
Emit setiap confluence step SRI ICT (Silver Bullet) sebagai webhook JSON ke backend Orchestrator.
Orchestrator yang mengelola state machine dan kirim **WAIT** atau **VALID SETUP** ke Telegram owner.

---

## v2 — apa yang berubah?

Riset dari 8+ professional-grade ICT Pine Script repos (yusin99, BAKOME, VitaHoang, craftzbay, btankutt, 0xSHAK1B, jchi18, orestefrison) menghasilkan 6 fix dari v1:

| # | Area | v1 | v2 |
|---|---|---|---|
| 1 | Timezone Silver Bullet | `hour == 10/14/19` (butuh chart TZ manual) | `input.session()` + `time()` dengan IANA TZ dropdown — robust terhadap chart TZ |
| 2 | Repaint HTF/DOL/SMT | `request.security()` default | `nrSecurity()` wrapper — `exp[1]` + `lookahead_on` no-repaint |
| 3 | Mid-bar alert | `alert.freq_once_per_bar` | `alert.freq_once_per_bar_close` — fire hanya saat bar close |
| 4 | MSS trigger | Wick crossover | Body-close break (`close > swing AND close[1] <= swing`) |
| 5 | Sweep TTL | Tidak pernah reset | Reset ke `na` setelah MSS fires (1 sweep = 1 MSS) |
| 6 | FVG tracking | Single var per side | Array FIFO boxes + body-close mitigation |
| 7 | HTF Bias | HH/HL pattern comparison | BOS/CHoCH state machine (`var int htfTrend`) |
| 8 | SMT filter | Pivot-based, no quality check | Correlation strength filter (default `|corr| ≥ 0.6`) |

Tambahan opsional:
- **PDH/PDL/PWH/PWL** lines (toggle off by default)
- **FVG mitigation mode** selector (body / wick / 50pct — saat ini body default, mode lain ekspansi masa depan)
- **MSS body-only toggle** (bisa di-disable kalau mau wick sensitivity)
- **SMT min correlation** input untuk filter pair noise

---

## Apa yang dilakukan indikator ini?

- Deteksi **HTF Bias** via BOS/CHoCH state machine dari higher timeframe (no-repaint, 1-bar lag).
- Deteksi **Draw On Liquidity (DOL)** — BSL/SSL level di HTF swing.
- Deteksi **Sweep SSL/BSL**, lalu **Market Structure Shift (MSS)** dengan body-close break.
- Deteksi **Inversion Fair Value Gap (IFVG)** dari array-based FVG tracking.
- Deteksi **Smart Money Technique (SMT)** divergence dengan correlation pair, filtered by correlation strength.
- Deteksi **Silver Bullet Time** via `time()` + `input.session()` — timezone-robust.
- Emit webhook JSON setiap confluence step muncul.
- Visual marker: sweep, MSS, IFVG, SB window, FVG boxes, DOL lines, optional PDH/PDL.

Indikator **tidak** mengeksekusi trade otomatis. Hanya memberi signal ke Orchestrator untuk approval manual owner.

---

## Setup di TradingView

### 1. Tambahkan indicator ke chart

1. Buka Pine Editor di TradingView (panel bawah → tab **Pine Editor**).
2. Copy-paste isi file `sri-ict-silver-bullet.pine` ke editor.
3. Klik **Save** lalu **Add to chart**.
4. Atur chart timeframe ke **M15** (default signal TF) atau timeframe pilihan lo.

### 2. Konfigurasi timezone Silver Bullet

Tidak perlu ganti chart timezone — v2 sudah pakai IANA timezone selector:

1. Klik roda gigi di indicator panel.
2. Cari group **SB Windows**.
3. **Silver Bullet timezone (IANA)** default `Asia/Jakarta` (WIB, UTC+7). Pilih sesuai exchange lo:
   - `Asia/Jakarta` (WIB)
   - `Asia/Tokyo` (JST)
   - `Europe/London` (GMT/BST)
   - `America/New_York` (EST/EDT)
   - `Etc/GMT+0`, `Etc/GMT-5`, `Etc/GMT-4`
4. **Asia/London/NY SB window** default per spec PRD. Bisa edit kalau broker lo pakai jam trading beda.

Catatan: timestamp di webhook payload (`"timestamp":"...+07:00"`) selalu emit WIB. Kalau lo butuh timestamp sesuai exchange TZ lain, perlu modifikasi `wibTimestamp()` di Pine Script.

### 3. Konfigurasi input parameters

| Group | Input | Default | Keterangan |
|---|---|---|---|
| Webhook | Pair symbol | `XAUUSD` | Pair untuk label di JSON |
| Webhook | Current chart timeframe label | `M15` | Label TF di JSON |
| Structure | HTF untuk Bias & DOL | `240` (H4) | Higher timeframe |
| Structure | Swing lookback bars | `5` | Pivot detection lookback |
| Structure | Max bars antar confluence step | `10` | TTL setup |
| Structure | MSS pakai body-close | `true` | Disable = wick sensitivity |
| SMT | Correlation symbol | `OANDA:EURUSD` | Pair korelasi |
| SMT | Enable SMT confluence | `true` | On/off |
| SMT | SMT minimum \|correlation\| | `0.6` | Filter weak correlation |
| FVG | FVG mitigation mode | `body` | body / wick / 50pct |
| FVG | Draw FVG boxes | `true` | Visual toggle |
| Order Blocks | Draw order blocks | `false` | Visual optional |
| Order Blocks | OB displacement ATR multiple | `1.5` | Threshold |
| SB Windows | Silver Bullet timezone | `Asia/Jakarta` | IANA TZ |
| SB Windows | Asia/London/NY window | `1000-1100`/`1400-1500`/`1930-2030` | Session window |
| DOL | Draw DOL lines | `true` | HTF BSL/SSL visual |
| DOL | Draw PDH/PDL/PWH/PWL | `false` | Extra liquidity levels |

### 4. Setup webhook alert (butuh TradingView Pro/Pro+/Premium)

**Free plan tidak bisa webhook.** Upgrade ke paid plan dulu.

Setelah upgrade:

1. Klik **Alerts** panel → **Create Alert**.
2. Condition: pilih indicator **YKP SRI ICT Silver Bullet v2** → pilih condition (misal `Any alert() function call` atau alertcondition spesifik).
3. **Webhook URL**: masukkan URL endpoint Orchestrator:
   ```
   https://your-cloudflare-tunnel.example.com/tradingview/webhook
   ```
4. Message: biarkan default (Pine Script auto-build JSON).
5. Repeat: **Once per bar close** (recommended untuk trading signal).
6. Simpan alert.

#### Webhook payload shape (v2)

```json
{
  "source": "tradingview",
  "pair": "XAUUSD",
  "timeframe": "M15",
  "signal": "MSS_BULL",
  "price": 4050.25,
  "session": "NY_SB",
  "timestamp": "2026-06-28T22:15:00+07:00",
  "bar_index": 15234
}
```

`bar_index` ditambahkan untuk dedup di Orchestrator backend.

---

## Signal reference

| Signal | Kapan muncul | Arti |
|---|---|---|
| `HTF_BIAS_BULL` | BOS/CHoCH HTF flip ke bull | Trend besar bullish |
| `HTF_BIAS_BEAR` | BOS/CHoCH HTF flip ke bear | Trend besar bearish |
| `DOL_BUY` | HTF swing high baru | BSL — buy-side liquidity |
| `DOL_SELL` | HTF swing low baru | SSL — sell-side liquidity |
| `SWEEP_SSL` | Low poke di bawah DOL sell-side + close balik | Setup bullish mulai |
| `SWEEP_BSL` | High poke di atas DOL buy-side + close balik | Setup bearish mulai |
| `MSS_BULL` | Body close break di atas swing high, dalam <TTL> bar setelah sweep SSL | Bullish structure shift |
| `MSS_BEAR` | Body close break di bawah swing low, dalam <TTL> bar setelah sweep BSL | Bearish structure shift |
| `IFVG_BULL` | Bullish FVG aktif (belum termitigasi by body close) + MSS baru | Entry zone bullish |
| `IFVG_BEAR` | Bearish FVG aktif + MSS baru | Entry zone bearish |
| `SMT_BULL` | Sweep SSL di chart pair, korelasi pair TIDAK sweep SSL + \|corr\| ≥ threshold | Bullish SMT |
| `SMT_BEAR` | Sweep BSL di chart pair, korelasi pair TIDAK sweep BSL + \|corr\| ≥ threshold | Bearish SMT |
| `SILVER_BULLET_TIME` | Entry ke Asia/London/NY killzone window (1x per session entry) | Window entry ICT |

---

## SRI ICT Hard Rules

Dijaga oleh Orchestrator, bukan oleh indicator:

1. **No Sweep = No MSS.**
   - Indicator guard: MSS hanya valid dalam `<i_setupTtl>` bar setelah sweep fires.
2. **No MSS = No Trade.**
   - Indicator guard: IFVG hanya valid setelah MSS dalam TTL window.
3. **No IFVG = No Entry.**
   - Orchestrator hanya declare `VALID_SETUP` kalau IFVG signal sudah pernah diterima untuk setup ini.

Sequence confluence lengkap: **HTF Bias → DOL → Sweep → MSS → IFVG → SMT (optional) → Silver Bullet Time → No high impact news → VALID SETUP.**

---

## News Block

Indicator **tidak** handle news block. Pine Script tidak bisa fetch API eksternal.

News high impact di-handle oleh **Orchestrator**:
- Orchestrator query ForexFactory API/RSS sebelum declare `VALID_SETUP`.
- Kalau ada high impact news dalam 30 menit ke depan, suppress `VALID_SETUP` dan kirim `WAIT` ke Telegram.

---

## Visual chart

| Marker | Lokasi | Warna |
|---|---|---|
| 🔻 Sweep SSL | Below bar | Hijau |
| 🔺 Sweep BSL | Above bar | Merah |
| 🔵 MSS Bull | Below bar | Biru |
| 🟠 MSS Bear | Above bar | Oranye |
| ➕ IFVG Bull | Below bar | Teal |
| ❌ IFVG Bear | Above bar | Maroon |
| 🔷 SB Window entry | Top | Purple |
| 📦 FVG boxes | On chart | Hijau (bull) / Merah (bear) |
| 📏 DOL BSL | Line | Merah transparan |
| 📏 DOL SSL | Line | Hijau transparan |
| 📏 PDH/PDL/PWH/PWL | Line | Abu-abu / biru (optional) |
| 📦 Order Blocks | On chart | Teal (bull) / Purple (bear) — optional |

---

## Troubleshooting

| Masalah | Penyebab | Solusi |
|---|---|---|
| Webhook tidak sampai | Free plan TradingView | Upgrade ke Pro/Pro+/Premium |
| Timestamp WIB salah | (v1 issue — v2 fix) | v2 emit `+07:00` regardless of chart TZ |
| Signal flood berulang | Alert frequency setting | Pilih **Once per bar close** |
| SMT tidak pernah fire | Korelasi pair di bawah threshold | Turunkan `i_smtMinCorr` atau ganti pair |
| DOL lines tidak muncul | Belum cukup histori HTF | Tunggu beberapa candle H4 |
| MSS muncul sebelum sweep | (v1 issue — v2 fix) | v2 reset sweep counter setelah MSS |
| FVG box bocor terus | Wick mitigation | v2 pakai body-close by default |
| HTF Bias tidak flip | 1-bar lag (no-repaint tradeoff) | Expected behavior |

---

## Catatan developer

Spec lengkap ada di:
- `YKP_Orchestrator_Detail_Workflow_for_Developer_v1.txt` §9-10
- PRD migrasi: `YKP_Hermez_Developer_Brief_Migration_V1.docx`

Top reference repos untuk pembelajaran lebih lanjut:
- yusin99/Tradingview-Indicator---Pivots-and-Killzones (Pine v5, 18 stars)
- yusin99/Tradingview-Pinescript-Indicator---Smart-money-concepts (Pine v5, 8 stars, ~1000 baris)
- btankutt/smc-pine-suite (Pine v5, BOS/CHoCH state machine, equal-highs/lows)
- 0xSHAK1B/FVG-VALIDATED-ORDER-BLOCKS (Pine v5, origin-most FVG OB detection)
- jchi18/aplus-ict-suite (Pine v5, 5-factor OB grading)
- vitahoang/ict-indicator (Pine v5, manual ms timezone offset)
- craftzbay/trading-view-opl-indicator (Pine v6, IANA timezone)
- BAKOME-Hub/BAKOME_ICT_Institutional (Pine v6, confluence boolean)

Nama sementara project: **Hermes / YKP AI Orchestrator**.
