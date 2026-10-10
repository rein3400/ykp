const tasks: [string, string][] = [
  ['FOH — Sistem & Transaksi', 'Menyiapkan dan menghitung uang modal kembalian kasir.'],
  ['FOH — Sistem & Transaksi', 'Memastikan semua perangkat (Tablet POS, mesin EDC, barcode QRIS) menyala, baterai penuh, dan terkoneksi internet.'],
  ['FOH — Sistem & Transaksi', 'Mengecek ketersediaan kertas struk (thermal) pada printer kasir dan mesin EDC.'],
  ['FOH — Koordinasi Menu', 'Berkoordinasi dengan Kitchen mengenai bahan yang kosong, lalu langsung memperbarui status menu sold out di sistem POS (kasir) maupun aplikasi online (Gofood/Grabfood/Shopeefood).'],
  ['FOH — Area Dine-in', 'Membersihkan meja kasir, semua kaca jendela, dan pintu masuk.'],
  ['FOH — Area Dine-in', 'Menata rapi kursi dan meja di area dine-in (indoor maupun outdoor).'],
  ['FOH — Area Dine-in', 'Mengecek lantai area dine-in (indoor dan outdoor), segera bersihkan/pel jika terlihat kotor.'],
  ['FOH — Area Dine-in', 'Menyalakan AC dan lampu area depan.'],
  ['FOH — Area Dine-in', 'Menyalakan playlist musik standar Suburbuns dengan volume yang pas.'],
  ['FOH — Servis & Minuman', 'Menyiapkan dan menata stok display minuman refill.'],
  ['FOH — Servis & Minuman', 'Mencuci, mengeringkan, dan menata plate/nampan saji.'],
  ['FOH — Servis & Minuman', 'Memastikan kelengkapan packaging di area kasir/pengambilan pesanan (box burger, paper bag, gelas plastik, sedotan, tisu, dan saus sambal/tomat siap pakai).'],
  ['BOH — Alat & Utilitas', 'Menyalakan exhaust (penyedot asap) dan semua lampu di area dapur.'],
  ['BOH — Alat & Utilitas', 'Mengecek indikator suhu chiller dan freezer untuk memastikan bahan baku (daging/patty) tersimpan di suhu yang aman.'],
  ['BOH — Alat & Utilitas', 'Mengecek ketersediaan gas LPG.'],
  ['BOH — Alat & Utilitas', 'Menyalakan dan memanaskan mesin deep fryer dan flat top (griddle) ke suhu standar.'],
  ['BOH — Prep & Quality Control', 'Mengecek kualitas minyak goreng (saring atau ganti jika sudah gelap/tidak layak).'],
  ['BOH — Prep & Quality Control', 'Mengecek seluruh ketersediaan bahan baku hari ini.'],
  ['BOH — Prep & Quality Control', 'Mempersiapkan (prep) semua dressing, patty, roti (bun), dan kondimen sayur.'],
  ['BOH — Prep & Quality Control', 'Wajib memberikan label tanggal pembuatan/pembukaan pada wadah bahan baku dan menerapkan sistem FIFO (First In First Out).'],
  ['BOH — Penerimaan & Waste', 'Menerima, mencuci, dan menyimpan bahan baku yang baru datang dari supplier sesuai standar (langsung masuk chiller/freezer jika perlu).'],
  ['BOH — Penerimaan & Waste', 'Memisahkan dan melaporkan kepada SPV/Purchasing jika ada bahan baku yang sudah expired, rusak, atau tidak layak guna (laporan waste).'],
  ['BOH — Koordinasi Operasional', 'Segera laporkan kepada Kasir dan bagian Purchasing jika ada bahan yang menipis atau habis, beserta alasannya, agar menu bisa langsung di-update sold out.'],
  ['BOH — Kebersihan Dapur', 'Membersihkan seluruh peralatan masak (spatula, capitan, wadah) sebelum dan langsung mencucinya kembali setelah digunakan.'],
  ['BOH — Kebersihan Dapur', 'Menyapu/mengepel lantai dapur dan memastikan area kerja (prep table) selalu bersih (lap basah & sanitizer food grade siap di station).']
];

export function suburbunOpeningTemplates(outlet: Record<string, string>): Record<string, string>[] {
  const name = (outlet.outlet_name ?? '').trim().toLowerCase();
  if (!/^suburbuns?(?:\s+colombo)?$/.test(name) || !outlet.outlet_id || !outlet.brand_id || !['active', '1'].includes((outlet.status ?? '').trim().toLowerCase())) {
    throw new Error('Select a verified active Suburbun outlet with brand and stable ID');
  }
  return tasks.map(([department, checklist_item], index) => ({
    checklist_template_id: `CT-SUB-PDF-${outlet.outlet_id}-${String(index + 1).padStart(2, '0')}`,
    brand_id: outlet.brand_id, outlet_id: outlet.outlet_id, checklist_type: 'OPENING',
    department, checklist_item, required_photo: 'false', target_value: '', tolerance_value: '',
    critical_flag: 'false', active_status: 'active'
  }));
}
