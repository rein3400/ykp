# Patch tombol "Minta Revisi" — halaman Finance payroll (VPS-only)

Target: `ykp-finance-v1/src/app/finance/payroll/payroll-client.tsx`
(commit VPS `262b459` — file ini tidak ada di lokal, jadi patch diterapkan di VPS).
Prinsip: Finance TIDAK menulis tab HR langsung — tombol memanggil HR-side endpoint
`POST {HR_APP_URL}/api/hr/payroll/needs-revision` dengan header `x-finance-secret`
(nilai = `FINANCE_NOTIFY_SECRET` env Finance, sama dengan di HR).

HR-side sudah live (branch `mom-1sep-fixes`):
- endpoint validasi: reason wajib min 5 karakter; hanya baris APPROVED + belum
  PAID/LOCKED yang bisa dikembalikan; PAID/LOCKED → 409.
- response 200 = `{ data: { approval_status: 'NEEDS_REVISION', revision_reason, ... } }`.

## Snippet (sesuaikan state lokal payroll-client)

```tsx
const [reviseId, setReviseId] = React.useState<string | null>(null);
const [reviseReason, setReviseReason] = React.useState("");
const [reviseErr, setReviseErr] = React.useState("");

async function requestRevision(payrollId: string) {
  if (reviseReason.trim().length < 5) {
    setReviseErr("Alasan revisi wajib diisi (min 5 karakter).");
    return;
  }
  setReviseErr("");
  const r = await fetch(`${process.env.NEXT_PUBLIC_HR_APP_URL ?? "http://localhost:3002"}/api/hr/payroll/needs-revision`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // secret disuntik server-side via route proxy Finance (JANGAN expose ke browser);
      // alternatif: panggil lewat API route Finance yang forward + attach header.
      "x-finance-secret": process.env.FINANCE_NOTIFY_SECRET ?? "",
    },
    body: JSON.stringify({ payroll_id: payrollId, reason: reviseReason.trim() }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    setReviseErr(j?.error?.message ?? `HTTP ${r.status}`);
    return;
  }
  setReviseId(null);
  setReviseReason("");
  router.refresh(); // baris kembali ke HR sebagai NEEDS_REVISION
}
```

CATATAN KEAMANAN: `x-finance-secret` tidak boleh dikirim dari browser (bisa
diintip). Pola benar = tombol browser → `POST /api/finance/payroll/request-revision`
(route Finance, session Finance login) → server-side forward ke HR dengan header
secret. Buat route proxy tipis itu dulu sebelum pasang tombol (10 menit kerja,
copy dari `notify-hr/route.ts` VPS yang sudah ada).

Tampilkan tombol hanya untuk baris `approval_status === 'APPROVED' &&
payment_status !== 'PAID'`, label "Minta Revisi", dengan dialog textarea alasan
wajib — mirror pola dialog unlock di `payroll-table.tsx` HR.
