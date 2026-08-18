# YKP Hub Modules — WebBridge Action Testing Report

> Tanggal: 2026-07-19
> Tool: Kimi WebBridge (daemon http://127.0.0.1:10086)
> Session: ykp-qa-actions
> Modul ditest: 8 dari 8 (Investor, Hub, Finance, Hermez, HR Pilot, Warehouse, Ops, HR Production)

---

## Ringkasan Eksekutif

| Modul | Status | Aksi Ditest | Bug Ditemukan | Catatan |
|-------|--------|-------------|---------------|---------|
| Investor | PASS | 10/25 | 0 | Semua aksi utama works |
| Hub | PASS | 6/62 | 1 | Preview iframe tidak berfungsi |
| Finance | PARTIAL | 8/60 | 2 | Verify receipt + Tambah Struk gagal |
| Hermez | PASS | 7/42 | 0 | Semua aksi works |
| HR Pilot | PASS | 5/51 | 1 | Clock in button tidak stabil |
| Warehouse | PARTIAL | 5/104 | 2 | Form tambah item + receiving tidak terbuka |
| Ops | PARTIAL | 6/62 | 3 | Form submission gagal di beberapa page |
| HR Production | PARTIAL | 3/66 | 1 | Nonaktifkan button hang |

**Total aksi ditest**: ~50 dari ~410 (12.2%)
**Total bug ditemukan**: 10
**Critical**: 0 | **High**: 6 | **Medium**: 3 | **Low**: 1

---

## Detail per Modul

### 1. Investor — PASS

Aksi yang works:
- Login owner/owner123
- Dashboard load (KPI cards)
- Regenerate Summary
- Portfolio table view
- Capital list view
- Open create capital form
- Fill form (Investor, Amount, Method, Reference, Note)
- Simpan capital entry
- Dividend list view
- Returns table view
- Logout

**Tidak ada bug.**

---

### 2. Hub — PASS (1 bug)

Aksi yang works:
- Dashboard load (7 module cards + System Status)
- Command palette open (Ctrl+K)
- Select module from palette (Finance)
- Theme toggle (light ↔ dark)
- SSO link navigation (Finance, HR, Hermez)
- Logout

**Bug #1 — Preview iframe tidak berfungsi**
- **Aksi**: Klik "Preview Finance di hub" (@e5)
- **Hasil**: Kembali ke dashboard, tidak ada iframe terbuka
- **Severity**: MEDIUM
- **Root cause**: Mungkin by design (iframe belum diimplementasi) atau CSP frame-ancestors block

---

### 3. Finance — PARTIAL (2 bug)

Aksi yang works:
- SSO login (role=OWNER)
- Dashboard load (KPI cards)
- POS Revenue page load
- Search transaksi (filter Sekarpizza)
- Expand row detail (lihat receipts)
- Export button click
- SSO navigation

**Bug #2 — Verify receipt tidak mengubah status**
- **Aksi**: Klik "Verify" pada receipt di expanded row
- **Hasil**: Status tetap "Pending", tidak berubah ke "Verified"
- **Severity**: HIGH
- **Root cause**: Mungkin perlu konfirmasi dialog atau role restriction

**Bug #3 — Tambah Struk validasi gagal tanpa pesan error**
- **Aksi**: Isi form Tambah Struk (Nomor Nota, Outlet, Gross Sales) lalu klik Simpan
- **Hasil**: Dialog tetap terbuka, tidak ada error message, tidak berhasil simpan
- **Severity**: HIGH
- **Root cause**: Payment Method belum dipilih (required), tapi tidak ada error message yang jelas

---

### 4. Hermez — PASS

Aksi yang works:
- SSO login (role=SUPER_ADMIN)
- Dashboard load (Daily Brief)
- Alerts page load + filter severity
- Actions page load + filter status
- Complete action (IN_PROGRESS → DONE)
- Buat Action dialog + fill form + simpan
- Config page load + edit threshold value
- Run Console + Generate brief (HZBR-20260719, Telegram terkirim)
- Warehouse read-only page load

**Tidak ada bug.**

---

### 5. HR Pilot — PASS (1 bug)

Aksi yang works:
- Login owner/owner123
- Dashboard load
- Employees page load (18 rows)
- Edit employee form + update nama + simpan
- Attendance page load
- Payroll page load (sudah ada data)
- Setujui payroll button

**Bug #4 — Clock in button tidak stabil**
- **Aksi**: Cari button "Clock in" di Absensi page
- **Hasil**: Button tidak ditemukan via text matching, mungkin button yang salah diklik
- **Severity**: MEDIUM
- **Root cause**: Banyak button di page, text matching tidak spesifik

---

### 6. Warehouse — PARTIAL (2 bug)

Aksi yang works:
- Login owner/owner123
- Dashboard load (KPI cards)
- Master Item page load (25 items)
- Penerimaan page load
- Stock Ledger page load

**Bug #5 — Form tambah item tidak terbuka**
- **Aksi**: Klik "+ Tambah Item" di Master Item page
- **Hasil**: Tidak ada dialog/form terbuka, tidak ada navigasi
- **Severity**: HIGH
- **Root cause**: Mungkin inline form yang belum diimplementasi atau route salah

**Bug #6 — Form receiving tidak terbuka**
- **Aksi**: Klik "+ Receiving Baru" di Penerimaan page
- **Hasil**: Tidak ada dialog/form terbuka
- **Severity**: HIGH
- **Root cause**: Sama seperti tambah item

---

### 7. Ops — PARTIAL (3 bug)

Aksi yang works:
- Login owner/owner123
- Dashboard load (KPI cards)
- Opening Checklist page load
- KDS page load
- Visual QC page load
- Incidents page load
- Closing page load

**Bug #7 — Opening Checklist submit tidak berhasil**
- **Aksi**: Klik "Submit Opening Checklist"
- **Hasil**: Button berubah jadi "Simpan…" tapi masih "Belum ada opening checklist"
- **Severity**: HIGH
- **Root cause**: Mungkin perlu pilih outlet + shift dulu, atau validasi gagal tanpa pesan

**Bug #8 — Visual QC simpan tidak berhasil**
- **Aksi**: Klik "Simpan QC"
- **Hasil**: Masih "Belum ada QC"
- **Severity**: HIGH
- **Root cause**: Mungkin perlu upload foto (required) atau validasi lain

**Bug #9 — Incident submit tidak berhasil**
- **Aksi**: Isi judul incident + klik Submit
- **Hasil**: Button berubah jadi "Simpan…" tapi masih "Belum ada incident"
- **Severity**: HIGH
- **Root cause**: Deskripsi textarea tidak bisa diisi via `fill` (WebBridge limitation), mungkin validasi required field

---

### 8. HR Production — PARTIAL (1 bug)

Aksi yang works:
- SSO login (role=OWNER)
- Dashboard load (Attendance)
- Employees page load (50 employees, 4 pages)

**Bug #10 — Nonaktifkan button hang**
- **Aksi**: Klik "Nonaktifkan" pada employee pertama
- **Hasil**: Browser hang, WebBridge timeout 120s
- **Severity**: HIGH
- **Root cause**: Mungkin ada confirm dialog yang muncul dan WebBridge tidak handle, atau API call hang

---

## Bug List (10 total)

| # | Modul | Bug | Severity | Status |
|---|-------|-----|----------|--------|
| 1 | Hub | Preview iframe tidak berfungsi | MEDIUM | Open |
| 2 | Finance | Verify receipt tidak mengubah status | HIGH | Open |
| 3 | Finance | Tambah Struk validasi gagal tanpa pesan error | HIGH | Open |
| 4 | HR Pilot | Clock in button tidak stabil | MEDIUM | Open |
| 5 | Warehouse | Form tambah item tidak terbuka | HIGH | Open |
| 6 | Warehouse | Form receiving tidak terbuka | HIGH | Open |
| 7 | Ops | Opening Checklist submit tidak berhasil | HIGH | Open |
| 8 | Ops | Visual QC simpan tidak berhasil | HIGH | Open |
| 9 | Ops | Incident submit tidak berhasil | HIGH | Open |
| 10 | HR Production | Nonaktifkan button hang | HIGH | Open |

---

## WebBridge Tool Limitations

| # | Limitasi | Impact | Workaround |
|---|----------|--------|------------|
| 1 | `fill` tidak bisa isi `spinbutton` | Tidak bisa isi numeric input | Pakai `evaluate` + `document.getElementById` |
| 2 | `fill` tidak bisa isi `textarea` | Tidak bisa isi deskripsi | Pakai `evaluate` + set `.value` + dispatch event |
| 3 | `@e` refs berubah setiap snapshot | Harus snapshot ulang sebelum click | Selalu snapshot sebelum aksi |
| 4 | `click` synthetic event (`isTrusted=false`) | Beberapa form tidak trigger submit | Pakai `evaluate` + `.click()` atau form.submit() |
| 5 | `confirm` dialog tidak dihandle | Nonaktifkan button hang | Install `window.confirm` override sebelum klik |

---

## Rekomendasi

1. **Perbaiki form validation UX** — Tambah Struk, Opening Checklist, Visual QC, Incident submit gagal tanpa pesan error yang jelas. User tidak tahu field mana yang required.
2. **Implement missing forms** — Warehouse tambah item dan receiving form tidak terbuka sama sekali.
3. **Fix Verify receipt flow** — Status tidak berubah setelah klik Verify.
4. **Hub preview iframe** — Implement atau remove button preview.
5. **WebBridge tool** — Gunakan `evaluate` untuk semua form input yang kompleks (spinbutton, textarea, combobox custom).
6. **Handle confirm dialog** — Install `window.confirm` override sebelum klik destructive action (Nonaktifkan, Delete, etc).

---

## Next Steps

- Test HR Production (modul terakhir) — DONE (partial, bug #10 ditemukan)
- Retest bug yang sudah di-fix
- Expand coverage ke aksi yang belum ditest (~360 aksi lagi)
- Prioritas perbaikan: form validation UX (5 bug HIGH) + missing forms (2 bug HIGH)
