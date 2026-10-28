export function HubGuide() {
  return (
    <section
      id="panduan-pengguna"
      className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-6"
    >
      <header className="flex items-center gap-3">
        <svg
          aria-hidden="true"
          className="h-6 w-6 shrink-0 text-blue-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M12 6v15M3 4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3V4Z" />
        </svg>
        <div>
          <h2 className="text-xl font-semibold">Panduan Pengguna</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Hub adalah pintu masuk; transaksi tetap dilakukan di modul
            masing-masing.
          </p>
        </div>
      </header>
      <details
        open
        className="mt-5 border-t border-slate-100 py-4 dark:border-slate-700"
      >
        <summary className="cursor-pointer font-semibold">
          1. Pilih dashboard sesuai tugas
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7">
          <li>
            Login memakai akun Hub Anda. Jangan gunakan password milik staff
            lain.
          </li>
          <li>
            Pilih HR untuk karyawan/absensi/payroll, Finance untuk transaksi dan
            antrean gaji, Warehouse untuk persediaan, atau Ops untuk checklist
            dan laporan outlet.
          </li>
          <li>
            Owner membaca ringkasan lintas modul; Investor membaca portofolio
            dan hasil sesuai hak akun.
          </li>
          <li>
            Klik Buka. Modul terbuka pada tab baru dan dapat meminta login
            tersendiri. Gunakan menu Panduan Pengguna di modul tujuan untuk
            langkah lengkap.
          </li>
        </ol>
        <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">
          <strong>Hasil yang diharapkan:</strong> Anda masuk ke modul yang
          tepat, bukan membuat transaksi langsung di Hub.
        </p>
      </details>
      <details className="border-t border-slate-100 py-4 dark:border-slate-700">
        <summary className="cursor-pointer font-semibold">
          2. Pahami status layanan dan akses
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7">
          <li>
            Periksa status layanan pada kartu modul dan daftar status. Gunakan
            refresh jika pemeriksaan sedang berlangsung.
          </li>
          <li>
            Jika kartu terkunci/tidak tersedia, catat nama modul dan waktu;
            minta admin memeriksa health, jaringan dan konfigurasi. Jangan
            mengganti password karena mengira status itu lock akun.
          </li>
          <li>
            Jika modul terbuka tetapi izin ditolak, hubungi admin untuk
            pemeriksaan role dan cakupan brand/outlet.
          </li>
        </ol>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          <strong>Penting:</strong> Health berhasil hanya membuktikan probe
          merespons, bukan seluruh transaksi benar. LOCKED payroll di HR berbeda
          dari modul yang terkunci karena health.
        </p>
      </details>
      <details className="border-t border-slate-100 py-4 dark:border-slate-700">
        <summary className="cursor-pointer font-semibold">
          3. Cari menu, ikuti alur dan laporkan masalah
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7">
          <li>
            Gunakan tombol pencarian atau pintasan yang tercetak di layar untuk
            menemukan modul.
          </li>
          <li>
            Untuk gaji: HR menyiapkan dan generate → Finance transfer atau minta
            revisi → HR validasi pembayaran. Periksa bukti di modul sumber.
          </li>
          <li>
            Jika gagal simpan atau koneksi terputus, periksa riwayat terlebih
            dahulu sebelum mengirim ulang.
          </li>
          <li>
            Saat meminta bantuan, berikan nama modul, waktu WIB, ID record dan
            pesan error. Jangan kirim password, token bot, App Password atau
            data gaji orang lain.
          </li>
          <li>
            Logout setelah memakai perangkat bersama. Akun modul yang sudah
            dibuka mungkin perlu di-logout secara terpisah.
          </li>
        </ol>
      </details>
    </section>
  );
}
