# ICT Trading Strategy — Sri ICT SOP

Sumber: `HERMES_AI_SRI_ICT_Developer_Brief.txt`. Dokumen ini **hanya** bahas strategi trading. Bukan infra, bukan deploy, bukan roadmap, bukan track lain.

---

## 1. Filosofi

ICT (Inner Circle Trader) bukan indikator-based. Ini *price action + liquidity + structure*. Inti: market bergerak untuk **mencuri liquidity**, bukan untuk chart pattern. Entry kita cuma valid kalau market sudah tunjukkan *intent* (sweep), *reversal* (MSS), dan *imbalance* (IFVG). Kalau salah satu hilang, trade ditolak.

---

## 2. Urutan Analisa (Wajib Berurutan HTF → LTF)

| # | Step | Apa yang dicari |
|---|---|---|
| 1 | **HTF Bias** | Daily/4H trend. Bullish, bearish, atau range. Semua trade LTF harus searah HTF. |
| 2 | **Premium/Discount** | Fib 50% equilibrium. Buy di discount, sell di premium. |
| 3 | **PD Array** | Order Block / Breaker / FVG yang searah bias. |
| 4 | **Liquidity** | BSL (buy-side) di swing high, SSL (sell-side) di swing low. |
| 5 | **Sweep** | Raid liquidity — harga nyentuh BSL/SSL lalu balik. |
| 6 | **MSS** | Market Structure Shift — confirm reversal struktur (HH→HL atau LH→LL break). |
| 7 | **IFVG** | Inversion FVG — FVG yang invalid lalu jadi support/resistance. Trigger entry. |
| 8 | **Entry** | Limit order di IFVG zone. |
| 9 | **Risk** | SL di bawah/atas PD array, hitung position size. |
| 10 | **TP/SL** | TP di opposite liquidity pool, SL di balik PD array. |

**Rule kunci**: kalau skip satu step, step berikutnya jadi tidak valid. HTF bias tanpa sweep = trap. Sweep tanpa MSS = continuation. MSS tanpa IFVG = late entry.

---

## 3. Hard Gates (Syarat Entry)

Lima rule ini **hard reject**. Kalau gagal satu, trade dibatalkan, bukan diberi score rendah.

| Rule | Gagal = |
|---|---|
| **No Sweep** | No trade |
| **No MSS** | No trade |
| **No IFVG** | No entry |
| **News Filter** | Lewati 30 menit sebelum/sesudah high-impact news |
| **Session Filter** | Hanya Kill Zone (London open / NY open) |

Score 80/100 adalah gate **terakhir** setelah 5 hard gate lewat. Bukan substitusi.

---

## 4. Scoring (Max 100, minimum 80)

| Komponen | Bobot |
|---|---|
| HTF alignment | 25 |
| Clean sweep (raid jelas, bukan sentuh tipis) | 15 |
| MSS valid (break struktur confirmed) | 15 |
| IFVG quality (zone bersih, tidak overlap noise) | 15 |
| RR ≥ 1:3 | 15 |
| Session timing (di Kill Zone) | 10 |
| News clear (tidak ada high-impact dekat) | 5 |

Trade dengan score <80 **tidak dikirim sinyal**. Score 80-85 = setup standar. Score >90 = A+ setup, boleh risk full 1-2%.

---

## 5. PD Array Detail (Yang Dicari di Step 3)

- **Order Block (OB)** — candle terakhir sebelum impulsive move. Bullish OB = candle bearish terakhir sebelum rally. Bearish OB = kebalikannya.
- **Breaker** — OB yang sudah fail sebagai support/resistance lalu flip peran. Tanda institutional reversal.
- **FVG (Fair Value Gap)** — imbalance 3-candle: gap antara candle 1 wick dan candle 3 wick. Market cenderung isi gap ini.
- **IFVG (Inversion FVG)** — FVG yang sudah di-pass harga, lalu zona itu jadi support/resistance baru. Ini **entry trigger utama**.
- **MSS (Market Structure Shift)** — break swing high/low terakhir. Confirm arah baru.
- **Liquidity (BSL/SSL)** — stop cluster di atas/bawah swing. Market sering sweep dulu sebalum jalan.
- **Judas Swing** — fake move di session open untuk sweep liquidity, lalu reversal. Hati-hati di London open.
- **SMT (Smart Money Technique)** — divergence antara dua instrument correlated (mis. ES/NQ, EU/GU). Konfirmasi sweep institutional.
- **Turtle Soup** — false breakout swing, entry balik arah setelah sweep.
- **Silver Bullet** — setup spesifik di Kill Zone: 1H FVG + liquidity sweep + MSS, window 1 jam.

---

## 6. Session Filter (Kapan Boleh Trade)

ICT trading cuma valid di Kill Zone — volume institutional aktif.

| Session | Waktu (server chart, biasanya GMT) | Setup |
|---|---|---|
| **London Kill Zone** | 02:00–05:00 | Judas swing, MSS London, BSL/SSL sweep |
| **NY Kill Zone** | 07:00–10:00 | Silver Bullet (10:00–11:00 window), continuation London |
| **London Close** | 10:00–12:00 | Scalping, hindari (low quality) |
| **Asia** | malam | Range, no trade kecuali BSL/SSL sweep Asian high/low |

**Di luar Kill Zone = no entry.** Range Asia dan dead zone (London close) sering trap.

---

## 7. News Filter

- High-impact (NFP, CPI, FOMC, rate decision): **no trade 30 menit sebelum + 30 menit sesudah**.
- Medium impact (PMI, retail sales): lewati 15 menit.
- News filter bukan untuk hindari volatilitas, tapi karena liquidity bisa di-reroute dan setup jadi invalid.

---

## 8. Risk Management (Hardcode di Risk Manager)

| Rule | Value |
|---|---|
| Max risk per trade | 1-2% balance |
| Max daily loss | 5% → stop trading hari itu |
| Max open trades | 2-3 concurrent |
| Min RR | 1:3 (di bawah ini score 0 di komponen RR) |
| SL placement | Di balik PD array (OB/Breaker), bukan arbitrary pips |
| TP placement | Opposite liquidity pool, bukan fixed RR |

**Anti-pattern yang ditolak sistem**:
- Revenge trade setelah loss (deteksi dari interval entry <2 menit setelah SL hit).
- FOMO entry (entry tanpa MSS/IFVG).
- Over-leverage (risk >2% di trade score <90).
- Moving SL (SL hanya boleh ke breakeven/+1, tidak boleh melebar).

---

## 9. Entry Checklist Final (sebelum kirim sinyal)

Sebelum sinyal keluar, semua ini harus `true`:

```
[ ] HTF bias jelas (bullish/bearish, bukan range)
[ ] Harga di premium/discount yang sesuai arah bias
[ ] PD array teridentifikasi (OB/Breaker/FVG)
[ ] Liquidity BSL/SSL sudah di-sweep
[ ] MSS confirmed (struktur break)
[ ] IFVG terbentuk di LTF (M5/M15)
[ ] Sekarang di Kill Zone (London/NY)
[ ] Tidak ada high-impact news dalam 30 menit
[ ] RR ≥ 1:3
[ ] Score ≥ 80/100
[ ] Risk ≤ 2% balance
[ ] Max open trades belum penuh
```

Satu `false` = no trade. Tidak negosiasi.

---

## 10. Trade Label (yang harus ada di setiap sinyal)

Setiap sinyal wajib kandung:
- **Bias** — HTF arah (bullish/bearish)
- **Setup** — tipe (Silver Bullet, Judas, Turtle Soup, OB, Breaker, dll)
- **Alasan entry** — narrative HTF→LTF kenapa masuk
- **Entry** — harga limit
- **SL** — harga stop loss + alasan penempatan
- **TP** — harga take profit + target liquidity
- **RR** — rasio risk:reward
- **Score** — total scoring 0-100
- **Status** — pending / approved / rejected / executed

---

## 11. Agent Role dalam Eksekusi Strategi

Bukan personel — ini logic layer yang validasi strategi:

| Agent | Tugas strategi |
|---|---|
| **ICT Mentor** | Baca struktur market, reasoning HTF→LTF, tentukan bias + PD array. |
| **News Analyst** | Flag high-impact news, kill signal di window berbahaya. |
| **Risk Manager** | Validate position size, max daily loss, RR, tolak trade kalau risk rule gagal. |
| **Trade Auditor** | Post-trade review: apakah SOP diikuti, attach screenshot + reasoning, score accuracy. |
| **Psychology Coach** | Deteksi pattern buruk dari journal: revenge, FOMO, over-leverage. Tidak blok trade, tapi flag. |

Trade flow: ICT Mentor → News Analyst → Risk Manager → (approval) → execution → Trade Auditor → Psychology Coach (post).

---

## 12. Yang Dilarang (Anti-Strategy)

- Entry tanpa sweep (trading ke arah OB belum disweep = makan stop).
- Entry sebelum MSS confirmed (pre-mature, sering continuation).
- Entry di luar Kill Zone (low volume, market noise).
- Hold trade melewati high-impact news (liquidity reroute).
- Average down / martingale (bukan ICT, itu gambling).
- Scalping di London Close (trap zone).
- Trade di range Asia tanpa sweep Asian high/low.

---

## 13. Target Setup yang Dicari (Prioritas)

1. **Silver Bullet** — Kill Zone + 1H FVG + sweep + MSS. Setup paling reliable.
2. **Judas Swing reversal** — London open fake move + MSS balik. RR tinggi.
3. **Turtle Soup** — false breakout swing + entry balik. Untuk liquidity grab.
4. **OB continuation** — HTF OB searah bias, entry setelah sweep ke OB.
5. **Breaker retest** — breaker zone retest dengan confluence MSS.

Semua setup harus lewat 10 step analisa + 5 hard gate + score 80. Setup premium cuma label, bukan exception ke rule.