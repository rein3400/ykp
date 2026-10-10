export type ClosingPdfSource = 'suburbun' | 'funkydak' | 'sekar-shift2';
const suburbun: [string, string[]][] = [
  ['FOH — Sales & Transaksi', [
    'Melakukan End of Shift pada sistem POS (tablet) untuk merekap total penjualan harian.',
    'Melakukan Settlement pada mesin EDC, pastikan struk fisik harian cocok dengan laporan.',
    'Menghitung uang tunai (cash), pisahkan uang setoran, dan siapkan uang modal dengan nominal pas untuk esok hari.'
  ]],
  ['FOH — Pembersihan Area & Servis', [
    'Membersihkan meja kasir, mengelap seluruh kaca jendela, dan area pintu masuk.',
    'Mencuci, mengeringkan, dan menyusun kembali semua plate/nampan kotor.',
    'Menumpuk kursi area dine-in (luar dan dalam), lalu memasukkannya ke dalam toko.'
  ]],
  ['FOH — Restock', ['Me-restock seluruh perlengkapan kasir (packaging, kertas struk thermal, tisu, sedotan, saus) agar tim opening besok tidak kehabisan stok.']],
  ['FOH — Keamanan Toko', [
    'Membersihkan dan mematikan peralatan (Tablet POS, Calling System, Printer), lalu simpan di tempat aman.',
    'Mencabut semua kabel dan komponen listrik dari terminal (AC, musik, kipas, lampu area depan).',
    'Mengosongkan tempat sampah kasir/area dine-in ke pembuangan luar.',
    'Mengunci pintu utama dan memastikan toko ditinggalkan dalam keadaan aman.'
  ]],
  ['BOH — Alat Masak', [
    'Membersihkan flat top griddle dan membuang sisa minyak kotor dari laci penampungan (drip tray).',
    'Mencuci bersih semua peralatan kecil (pisau, cutting board, spatula, capitan).',
    'Membersihkan dan mematikan penyedot asap (exhaust).'
  ]],
  ['BOH — Area Kerja & Sanitasi', [
    'Mengelap bersih seluruh permukaan meja kerja (prep table), bagian luar freezer, dan chiller.',
    'Menyapu dan mengepel seluruh lantai area dapur dan gudang.',
    'Mengikat rapat plastik sampah dapur (waste/food scrap), buang ke tempat pembuangan luar, dan bilas tempat sampahnya.'
  ]],
  ['BOH — Inventory & Prep', [
    'Mengecek ulang stok bahan yang habis/menipis dan segera laporkan ke tim Purchasing untuk menghindari menu sold out besok.',
    'Membungkus rapat (wrap) sisa bahan terbuka atau pindahkan ke wadah kedap udara, lalu simpan kembali ke chiller.',
    'Mengeluarkan (thawing) patty daging dari freezer ke chiller sesuai proyeksi porsi untuk esok hari.'
  ]],
  ['BOH — Keamanan & Utilitas', [
    'WAJIB: Melepas semua konektor/regulator gas LPG dari tabungnya.',
    'Mengecek indikator suhu chiller dan freezer untuk memastikan mesin bekerja normal sebelum ditinggalkan.',
    'Memastikan area luar dan dalam toko sudah bersih bersama tim kasir.',
    'Memadamkan seluruh sakelar listrik dan lampu dapur (kecuali saluran listrik untuk chiller dan freezer).'
  ]]
];
const funkydak: [string, string[]][] = [
  ['Kasir', [
    'Melakukan proses tutup kasir (End of Day) pada sistem POS agar data penjualan harian terekam.',
    'Mematikan aplikasi ojek online (GrabFood, ShopeeFood, dll) agar tidak ada pesanan masuk di luar jam buka.',
    'Melakukan settlement pada mesin EDC dan mencetak struk rekap harian.',
    'Menghitung uang fisik di laci kasir, memisahkan modal awal (float cash) dengan uang setoran hasil penjualan, lalu menyimpannya sesuai SOP aman.',
    'Merapikan seluruh struk, nota pengeluaran, dan melengkapi catatan di buku log harian.',
    'Mengecek sisa stok minuman dan melaporkannya ke tim purchasing untuk jadwal restock.',
    'Mematikan komputer/tablet POS, mesin EDC, dan mematikan musik (playlist).',
    'Mengelap dan merapikan meja counter kasir agar bersih dan siap digunakan untuk besok pagi.'
  ]],
  ['Helper', [
    'Membersihkan mesin kopi dan mesin waffle, memastikan tidak ada sisa bubuk kopi, tumpahan susu, atau sisa adonan yang mengeras semalaman.',
    'Mencuci bersih alat produksi minuman/waffle serta sisa piring, gelas, dan sendok garpu bekas dari customer.',
    'Menutup rapat sisa bahan baku minuman dan adonan waffle, lalu memindahkannya kembali ke dalam chiller.',
    'Mengecek sisa bahan baku (minuman, adonan waffle, packaging) yang stoknya sisa sedikit, lalu melaporkannya ke tim purchasing untuk restock besok.',
    'Mengangkat dan menata kursi ke atas meja dine-in untuk memudahkan pembersihan lantai.',
    'Menyapu dan mengepel seluruh lantai area dine-in menggunakan cairan pembersih.',
    'Membuang seluruh sampah dari area depan dan toilet ke tempat pembuangan akhir di luar outlet. Cuci tempat sampah jika berbau kotor.',
    'Membersihkan area toilet secara menyeluruh (menyikat lantai, membersihkan kloset) agar tidak berkerak atau berbau keesokan harinya.',
    'Mematikan AC dan seluruh lampu area dine-in (kecuali lampu luar/signage jika ada instruksi khusus).'
  ]],
  ['Kitchen', [
    'Mematikan seluruh peralatan panas (deep fryer, warmer etalase, kompor) dan memastikan regulator gas sudah ditutup/dicabut dengan aman.',
    'Mencuci bersih seluruh peralatan dapur (capitan, saringan, mangkuk tepung) dan memastikan tidak ada satu pun cucian kotor yang ditinggalkan semalaman.',
    'Mengelap seluruh meja kerja (prep station) dari cipratan minyak dan sisa tepung.',
    'Mengecek sisa bahan baku mentah, membungkusnya dengan plastik wrap atau wadah kedap udara, dan menyimpannya kembali ke chiller/freezer dengan rapi.',
    'Mencatat bahan baku dapur yang stoknya sudah menipis atau habis, lalu melaporkannya untuk jadwal restock besok.',
    'Membuang seluruh sampah organik dapur ke tempat pembuangan luar ruangan agar tidak mengundang hama (tikus/kecoa).',
    'Menyapu dan mengepel lantai dapur menggunakan cairan penghilang lemak (degreaser).',
    'Mematikan exhaust fan dan lampu area dapur.'
  ]]
];
const sekar: [string, string[]][] = [
  ['Shift 2 — Kasir', [
    'Handover awal dari Shift 1 (Pengecekan modal kasir & serah terima operasional)',
    'Konfirmasi & minta informasi ketersediaan menu (Online & Offline) dari Shift 1',
    'Lap dan bersihkan area kaca display (pastikan bersih dari noda / bekas remahan semolina)',
    'End Shift MokaPOS & Settlement EDC (Cetak rekap penjualan harian)',
    'Update sisa stok minuman kemasan (catat jika menipis / perlu restock)',
    'Report produksi pizza & left over pizza (Catat waste / sisa harian)',
    'Matikan musik, AC, dan seluruh lampu area kasir & dining',
    'Absen pulang (Fingerprint / Mobile Attendance)'
  ]],
  ['Shift 2 — Helper', [
    'Handover tugas & catatan dari Shift 1',
    'Cek kebersihan toilet & area dine in (Indoor & Outdoor)',
    'Buang seluruh sampah dari area Kitchen, Dining Indoor, dan Outdoor ke TPS luar',
    'Restock kebutuhan helper & hygiene (sabun cuci tangan, tissue, sabun cuci piring, dll)',
    'Sapu dan pel menyeluruh seluruh lantai Kitchen area',
    'Absen pulang'
  ]],
  ['Shift 2 — Kitchen', [
    'Handover tugas, inventori & preparasi dari Shift 1',
    'Bersihkan dan sanitasi seluruh area kerja produksi pizza & meja prep',
    'Matikan Oven dan Blower / Exhaust hood kitchen',
    'SAFETY CHECK: Pastikan mematikan / menutup kran regulator tabung gas',
    'Cek & pastikan seluruh peralatan listrik dapur mati (Kecuali Freezer & Chiller tetap ON)',
    'Restock & persiapan bahan baku untuk Shift 2 / persiapan esok hari',
    'Absen pulang'
  ]]
];

export function closingPdfTemplates(source: ClosingPdfSource, outlet: Record<string, string>): Record<string, string>[] {
  const name = (outlet.outlet_name ?? '').trim().toLowerCase().replace(/\s+/g, '');
  const valid = source === 'suburbun' ? ['suburbun', 'suburbuns', 'suburbuncolombo', 'suburbunscolombo'].includes(name)
    : source === 'funkydak' ? name === 'funkydakcolombo' : ['sekarpizzacolombo', 'sekarpizzatirtodipuran'].includes(name);
  if (!valid || !outlet.outlet_id || !outlet.brand_id || !['active', '1'].includes((outlet.status ?? '').trim().toLowerCase())) throw new Error('Closing PDF requires a verified active matching outlet');
  let ordinal = 0;
  return (source === 'suburbun' ? suburbun : source === 'funkydak' ? funkydak : sekar).flatMap(([department, items]) => items.map((checklist_item) => ({
    checklist_template_id: `CT-CLOSE-PDF-${source}-${outlet.outlet_id}-${String(++ordinal).padStart(2, '0')}`,
    brand_id: outlet.brand_id, outlet_id: outlet.outlet_id, checklist_type: 'CLOSING', department, checklist_item,
    required_photo: 'false', critical_flag: 'false', target_value: '', tolerance_value: '', active_status: 'active'
  })));
}
