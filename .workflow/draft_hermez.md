# Hermez AI Layer — Technical Blueprint (Draft)

> Source: `YKP_Hermez_Developer_Brief_Migration_V1.docx`, Sections 3, 4, 8, 9, 12.
> Scope: V1 Hermez — read-only summary consumer + daily brief + alert. No input, no write-back, no auto-transfer.

---

## 1. Posisi Sistem

```
HR Web App                Finance Web App
   |                          |
   v                          v
YKP_HR_DATABASE         YKP_FINANCE_DATABASE
   |                          |
   v                          v
hr_daily_summary        fin_daily_summary        <-- satu-satunya sheet yang dibaca Hermez
   \                          /
    \                        /
     v                      v
     HERMEZ AI COMMAND CENTER
              |
              v
   Telegram Owner Brief / Alert / Weekly Insight
              |
              v
   hermes_daily_brief  +  hermes_alert_log   <-- output Hermez (log only)
```

**Invariant:** Hermez membaca **hanya** `hr_daily_summary` dan `fin_daily_summary`. Tidak baca raw `hr_attendance`, `hr_payroll`, `fin_pos_daily`, `fin_supplier_cost`, `fin_petty_cash`, `fin_expense`. Raw sheet tetap urusan HR/Finance app.

---

## 2. Column Contracts — Sheet yang Dibaca Hermez

### 2.1 `hr_daily_summary`

Satu baris = ringkasan HR satu outlet, satu tanggal. Diisi oleh HR app (bukan Hermez).

| # | Column | Type | Format | Wajib | Contoh | Sumber/Derivasi |
|---|--------|------|--------|-------|--------|----------------|
| 1 | `date` | date | `YYYY-MM-DD` | Ya | `2026-06-29` | Tanggal operasional outlet |
| 2 | `brand` | string | ref `master_brand.brand_name` | Ya | `YKP Kitchen` | Join ke master_brand |
| 3 | `outlet` | string | ref `master_outlet.outlet_name` | Ya | `YKP Surabaya 01` | Join ke master_outlet |
| 4 | `total_staff` | int | >= 0 | Ya | `8` | Hitung employee aktif di outlet tsb |
| 5 | `staff_present` | int | 0..total_staff | Ya | `7` | Count check-in hari itu |
| 6 | `staff_late` | int | 0..total_staff | Ya | `3` | Count check-in lewat shift + toleransi |
| 7 | `staff_absent` | int | 0..total_staff | Ya | `1` | total_staff − present (tanpa izin) |
| 8 | `payroll_issue` | string | free text / "none" | Ya | `bonus blm diapprove` | Flag dari modul payroll |
| 9 | `major_hr_issue` | string | free text / "none" | Ya | `SPV no-show` | Issue signifikan, bukan rutin |
| 10 | `recommended_action` | string | free text | Ya | `briefing SPV` | Saran dari HR app |

Aturan:
- `staff_present + staff_absent == total_staff` (invariant HR app wajib jaga).
- `brand`/`outlet` wajib match `master_brand`/`master_outlet`; nama bebas → reject baris, log ke `hermes_alert_log` severity `warning` alert_type `schema_mismatch`.
- Null numeric = error, bukan 0. Hermez skip baris + alert.

### 2.2 `fin_daily_summary`

Satu baris = ringkasan finance satu outlet, satu tanggal. Diisi oleh Finance app.

| # | Column | Type | Format | Wajib | Contoh | Sumber/Derivasi |
|---|--------|------|--------|-------|--------|----------------|
| 1 | `date` | date | `YYYY-MM-DD` | Ya | `2026-06-29` | Tanggal operasional |
| 2 | `brand` | string | ref master_brand | Ya | `YKP Kitchen` | Join master_brand |
| 3 | `outlet` | string | ref master_outlet | Ya | `YKP Surabaya 01` | Join master_outlet |
| 4 | `revenue` | int (IDR) | >= 0, rupiah penuh | Ya | `5400000` | Sum `fin_pos_daily.net_sales` |
| 5 | `expense` | int (IDR) | >= 0 | Ya | `1200000` | Sum `fin_expense` hari tsb |
| 6 | `supplier_cost` | int (IDR) | >= 0 | Ya | `800000` | Sum `fin_supplier_cost` jatuh tempo hari tsb |
| 7 | `petty_cash_out` | int (IDR) | >= 0 | Ya | `150000` | Sum keluar `fin_petty_cash` |
| 8 | `unpaid_supplier` | int (IDR) | >= 0 | Ya | `2300000` | Outstanding `fin_supplier_cost` belum lunas |
| 9 | `cash_difference` | int (IDR) | signed | Ya | `-25000` | Kas fisik − kas sistem (boleh negatif) |
| 10 | `net_profit_estimate` | int (IDR) | signed | Ya | `3250000` | revenue − expense − supplier_cost |
| 11 | `major_finance_issue` | string | free text / "none" | Ya | `selisih kas` | Issue signifikan |
| 12 | `recommended_action` | string | free text | Ya | `audit closing` | Saran Finance app |

Aturan:
- Semua nilai rupiah disimpan integer penuh, no decimal, no thousand separator di storage.
- `cash_difference` wajib signed (boleh negatif).
- `net_profit_estimate = revenue − expense − supplier_cost` (HR app tidak ikut rumus ini).
- Null numeric = error → skip baris + alert.

---

## 3. Output Schemas — Log Milik Hermez

Hermez menulis **hanya** ke dua sheet ini. Tidak menulis ke sheet HR/Finance manapun.

### 3.1 `hermes_daily_brief`

| # | Column | Type | Format | Wajib | Contoh |
|---|--------|------|--------|-------|--------|
| 1 | `date` | date | `YYYY-MM-DD` | Ya | `2026-06-29` |
| 2 | `generated_at` | datetime | `YYYY-MM-DD HH:MM:SS+07:00` | Ya | `2026-06-29 22:05:00+07:00` |
| 3 | `brief_text` | text (multiline) | Telegram-formatted | Ya | (lihat Section 8) |
| 4 | `alert_level` | enum | `green` \| `yellow` \| `red` | Ya | `yellow` |
| 5 | `sent_to_owner` | bool | true/false | Ya | `true` |
| 6 | `sent_at` | datetime | `YYYY-MM-DD HH:MM:SS+07:00` | Ya (jika sent) | `2026-06-29 22:05:12+07:00` |

- Satu baris per tanggal (level owner, gabung semua brand/outlet).
- `alert_level` = level tertinggi dari semua alert hari itu. green = tanpa alert, yellow = ada warning, red = ada critical.
- `brief_text` disimpan verbatim yang dikirim Telegram (plain text, bukan markdown sheet).

### 3.2 `hermes_alert_log`

| # | Column | Type | Format | Wajib | Contoh |
|---|--------|------|--------|-------|--------|
| 1 | `alert_id` | string | `ALR-YYYYMMDD-<seq>` | Ya | `ALR-20260629-003` |
| 2 | `date` | date | `YYYY-MM-DD` | Ya | `2026-06-29` |
| 3 | `brand` | string | ref master_brand / `ALL` | Ya | `YKP Kitchen` |
| 4 | `outlet` | string | ref master_outlet / `ALL` | Ya | `YKP Surabaya 01` |
| 5 | `alert_type` | enum | (lihat Section 5) | Ya | `cash_diff` |
| 6 | `severity` | enum | `warning` \| `critical` | Ya | `warning` |
| 7 | `message` | text | satu kalimat | Ya | `Selisih kas -Rp25.000 di YKP Surabaya 01` |
| 8 | `source_app` | enum | `hr` \| `finance` | Ya | `finance` |
| 9 | `status` | enum | `open` \| `ack` \| `resolved` | Ya | `open` |
| 10 | `action_taken` | text | free / `none` | Ya | `none` |

- `status` default `open`. Diubah `ack`/`resolved` hanya via owner/manager input manual — Hermez tidak auto-resolve.
- `action_taken` diisi owner setelah eksekusi; Hermez tidak mengisi.

---

## 4. Trigger / Threshold Rules

Semua threshold **configurable** di `hermez_config` (key-value). Nilai di bawah = default konservatif V1. Brief tidak menetapkan angka eksplisit → ini pilihan aman, wajib review owner sebelum pilot.

| Alert type | Sumber sheet | Kondisi | Severity default | Pesan template |
|------------|--------------|---------|------------------|----------------|
| `late_staff` | hr_daily_summary | `staff_late / total_staff >= 0.30` ATAU `staff_late >= 3` (ambil yg lebih ketat) | warning | `{n} staff telat di {outlet} ({pct}% dari {total})` |
| `late_staff` | hr_daily_summary | `staff_late / total_staff >= 0.50` | critical | `Krisis absensi: {n}/{total} telat di {outlet}` |
| `cash_diff` | fin_daily_summary | `abs(cash_difference) >= 50_000` | warning | `Selisih kas {diff} di {outlet}` |
| `cash_diff` | fin_daily_summary | `abs(cash_difference) >= 200_000` | critical | `Selisih kas besar {diff} di {outlet} — audit wajib` |
| `supplier_overdue` | fin_daily_summary | `unpaid_supplier > 0` DAN umur tagihan >= 7 hari (lihat catatan) | warning | `Supplier overdue {amount} di {outlet}` |
| `supplier_overdue` | fin_daily_summary | `unpaid_supplier > 0` DAN umur >= 14 hari | critical | `Supplier overdue kritis {amount} di {outlet} — risiko supply stop` |
| `petty_cash_anomaly` | fin_daily_summary | `petty_cash_out >= 300_000` | warning | `Petty cash keluar tinggi {amount} di {outlet}` |
| `petty_cash_anomaly` | fin_daily_summary | `petty_cash_out >= 1_000_000` | critical | `Petty cash abnormal {amount} di {outlet} — cek nota` |
| `high_expense` | fin_daily_summary | `expense / revenue >= 0.40` (margin ratio) | warning | `Expense ratio {pct}% di {outlet} (rev {rev})` |
| `high_expense` | fin_daily_summary | `expense > revenue` (loss) | critical | `Loss operasional {outlet}: expense {exp} > revenue {rev}` |
| `schema_mismatch` | hr/fin | brand/outlet tidak match master | warning | `Baris {sheet} tanggal {date}: brand/outlet tidak dikenal` |
| `data_missing` | hr/fin | baris summary kosong/null untuk outlet yg seharusnya ada | warning | `Tidak ada summary {sheet} untuk {outlet} tanggal {date}` |

Catatan:
- `supplier_overdue` butuh umur tagihan. `fin_daily_summary` hanya punya `unpaid_supplier` (nominal). Umur tagihan harus ada di `fin_supplier_cost` (raw) — **tapi Hermez tidak baca raw**. Maka V1: treat `unpaid_supplier > 0` sebagai overdue jika Finance app sudah flag lewat `major_finance_issue` berisi kata "overdue"/" jatuh tempo". Alt: tambah kolom `unpaid_supplier_age_days` di `fin_daily_summary` (rekomendasi upgrade, lihat Section 9). Sementara pakai heuristic `major_finance_issue`.
- Threshold ratio staff late (0.30/0.50) dan expense (0.40) adalah default; owner wajib kalibrasi setelah pilot 7 hari.

---

## 5. Alert Type Enum

```
late_staff
cash_diff
supplier_overdue
petty_cash_anomaly
high_expense
schema_mismatch
data_missing
```

---

## 6. Brief Generation Logic

Pseudocode alur harian Hermez:

```python
def generate_daily_brief(date: str) -> dict:
    hr_rows  = read_sheet("hr_daily_summary",  filter=date)
    fin_rows = read_sheet("fin_daily_summary", filter=date)

    # 1. Validate schema + master refs
    hr_rows, hr_issues   = validate(hr_rows,  master_brand_outlet)
    fin_rows, fin_issues = validate(fin_rows, master_brand_outlet)

    # 2. Aggregate per brand/outlet + group total
    hr_agg  = aggregate_hr(hr_rows)
    fin_agg = aggregate_fin(fin_rows)

    # 3. Evaluate triggers -> alerts
    alerts = []
    alerts += check_late_staff(hr_rows)
    alerts += check_cash_diff(fin_rows)
    alerts += check_supplier_overdue(fin_rows)
    alerts += check_petty_cash(fin_rows)
    alerts += check_high_expense(fin_rows)
    alerts += hr_issues + fin_issues  # schema/data_missing

    # 4. Determine alert_level = max severity
    level = "green" if not alerts else ("red" if any(a.severity=="critical") else "yellow")

    # 5. Compose brief_text (Section 7 format)
    brief_text = compose_brief(date, hr_agg, fin_agg, alerts)

    # 6. Write log ONLY (no write-back to HR/Finance)
    brief_id = write_log("hermes_daily_brief", {
        "date": date, "generated_at": now(), "brief_text": brief_text,
        "alert_level": level, "sent_to_owner": False, "sent_at": None,
    })
    for a in alerts:
        write_log("hermes_alert_log", a.as_row())

    # 7. Send Telegram (jika level != green OR owner opt-in green)
    if level != "green" or owner_wants_green:
        send_telegram(brief_text)
        update_brief(brief_id, sent_to_owner=True, sent_at=now())

    return {"brief_id": brief_id, "level": level, "alert_count": len(alerts)}
```

Aturan komposisi:
- Urutan section brief: Header → Finance (revenue, expense, profit) → HR (absensi) → Alerts list → Action besok.
- Jika tidak ada alert sama sekali → level `green`, brief tetap dikirim bila owner opt-in (default: kirim hanya yellow/red).
- Angka rupiah format `Rp1.234.000` di brief_text; di storage integer.
- Outlet tanpa baris summary → masuk `data_missing` alert, tidak dihitung di aggregate.

---

## 7. Telegram Output Format

Template `brief_text` (plain text, newline-separated, no markdown agar selamat di Telegram plain mode):

```
YKP Daily Brief - 29 Jun 2026
Level: YELLOW

[Finance]
- Total revenue: Rp12.450.000
- Total expense: Rp3.200.000
- Net profit estimate: Rp8.450.000
- Unpaid supplier: Rp2.300.000

[HR]
- Total staff: 16 | Present: 14 | Late: 3 | Absent: 2

[Alerts] (2)
- [warning] 3 staff telat di YKP Surabaya 01 (37% dari 8)
- [warning] Selisih kas -Rp25.000 di YKP Surabaya 01

[Action besok]
- Audit closing kas YKP Surabaya 01
- Briefing SPV absensi
```

Aturan:
- Header tetap `YKP Daily Brief - DD MMM YYYY`.
- Section kosong tetap tampil dengan label, isi `none`/`0` (jangan drop section — owner bisa cek kelengkapan).
- `[Alerts]` tampilkan `(N)` = jumlah alert hari itu. Tiap alert satu baris dengan prefix `[severity]`.
- `[Action besok]` turun dari `recommended_action` gabungan HR+Finance + alert critical. Max 5 baris.
- Panjang maks 4096 char (limit Telegram). Jika lebih → split per brand/outlet, kirim urutan.

---

## 8. Example Output (dari brief, dikembangkan)

Contoh real dari brief Section 12:

```
YKP Daily Brief - 29 Jun 2026
Level: RED

[Finance]
- Total revenue: Rp9.800.000
- Total expense: Rp4.100.000
- Net profit estimate: Rp4.500.000
- Unpaid supplier: Rp2.300.000

[HR]
- Total staff: 10 | Present: 7 | Late: 3 | Absent: 0

[Alerts] (3)
- [critical] Petty cash abnormal Rp1.200.000 di YKP Surabaya 01 — cek nota
- [warning] 3 staff telat di YKP Surabaya 01 (30% dari 10)
- [warning] Selisih kas -Rp50.000 di YKP Surabaya 01

[Action besok]
- Audit closing kas YKP Surabaya 01
- Cek nota petty cash outlet X
- Briefing SPV absensi
```

Versi brief asli (lebih singkat, tanpa aggregate total):
```
YKP Daily Brief - [Tanggal]
- Total revenue: Rp...
- Finance issue: petty cash outlet X tinggi
- HR issue: 3 staff telat di outlet Y
- Alert: selisih kas Rp...
- Action besok: audit closing, cek nota petty cash, briefing SPV.
```

---

## 9. Scheduling

| Job | Trigger | Waktu (WIB) | Sumber | Output |
|-----|---------|-------------|--------|--------|
| Daily brief generate | Cron harian | 22:00 | hr/fin_daily_summary hari H | hermes_daily_brief + hermes_alert_log |
| Daily brief send Telegram | Setelah generate | 22:00–22:05 | brief hari H | Telegram owner |
| Retry send bila gagal | Cron 15 menit setelah | 22:15 | brief hari H belum `sent_to_owner=true` | Telegram |
| Weekly insight (V1.1) | Cron mingguan | Senin 08:00 | 7 hari brief + alert | hermes_weekly_insight (sheet baru) |

Aturan:
- 22:00 dipilih karena closing outlet umumnya 21:00, summary app terisi paling telat ~21:30. Buffer 30 menit.
- Bila summary hari H belum ada sampai 22:00 → generate brief dengan `data_missing` alert per outlet, tetap kirim (level yellow minimum).
- Idempotent: re-run job hari H menimpa baris `hermes_daily_brief` sama (key `date` unik), alert log jadi duplikat → job cek `alert_id` exists sebelum insert.
- Timezone: `Asia/Jakarta` (+07:00). Semua `date` = tanggal lokal, bukan UTC.

---

## 10. No-Write-Back Policy

Dari brief Section 3 & 12:

> Hermez belum melakukan edit data atau transfer uang otomatis. Semua action tetap butuh approval owner/manager.
> Hermez hanya membaca summary, membuat daily brief, alert, insight, dan weekly report.
> Jangan jadikan Hermez sebagai tempat input operasional.

Kontrak teknis:
- Hermez **read-only** ke `hr_daily_summary`, `fin_daily_summary`, `master_brand`, `master_outlet`.
- Hermez **write-only** ke `hermes_daily_brief`, `hermes_alert_log` (sheet output sendiri).
- Hermez **tidak pernah** menulis ke: `hr_attendance`, `hr_payroll`, `fin_pos_daily`, `fin_supplier_cost`, `fin_petty_cash`, `fin_expense`, atau sheet master manapun.
- Tidak ada API call ke HR/Finance app untuk mutate data.
- `hermes_alert_log.status` hanya berubah via input owner/manager (manual) — Hermez tidak auto-ack/auto-resolve.
- Eksekusi action (audit, transfer, briefing) = manusia, bukan Hermez. Hermez hanya rekomendasi di `brief_text`.

Pencegahan teknis:
- Service account Hermez: scope read-only ke workbook HR/Finance; scope write hanya ke sheet output Hermez di workbook terpisah (`YKP_HERMEZ_OUTPUT` atau tab di `YKP_CENTRAL_DATABASE`).
- Audit log: setiap akses sheet dicatat (timestamp, sheet, mode read/write).
- Kill switch: env var `HERMEZ_WRITEBACK_ENABLED=false` (hard default). Bahkan jika kode salah panggil write, scope service account blokir.

---

## 11. Upgrade Path (di luar scope V1)

Ditandai `ponytail:` — skip di V1, add saat trigger muncul:

- `unpaid_supplier_age_days` kolom di `fin_daily_summary` → supplier_overdue akurat tanpa heuristic. Add saat Finance app stabil & owner butuh aging report.
- Weekly insight sheet + cron Senin. Add saat 30 hari data brief terkumpul.
- Operational/Marketing summary sheet menyusul pola sama (`ops_daily_summary`, `mkt_daily_summary`). Add saat app tsb jalan.
- Auto-ack alert dari Telegram button. Add saat owner nyaman dgn volume alert tinggi.
- Threshold auto-tuning dari 30-day rolling. Add saat data cukup & owner minta kalibrasi otomatis.

`→ skipped: aging akurat, weekly, multi-domain, auto-ack, auto-tune. add saat [pilot 30 hari selesai + owner request].`

---

## 12. Definition of Done — Hermez V1

- [ ] Baca `hr_daily_summary` + `fin_daily_summary` tanpa error schema.
- [ ] Generate brief harian 22:00, kirim Telegram.
- [ ] Tulis `hermes_daily_brief` + `hermes_alert_log` dengan kontrak Section 3.
- [ ] 5 trigger aktif (late_staff, cash_diff, supplier_overdue, petty_cash_anomaly, high_expense) + 2 sistem (schema_mismatch, data_missing).
- [ ] Tidak ada write ke sheet HR/Finance (audit log bersih).
- [ ] Owner bisa ubah `status` alert log manual tanpa Hermez overwrite.
- [ ] Pilot 7 hari: brief terkirim tepat waktu, alert sesuai realita, angka match Moka/manual.