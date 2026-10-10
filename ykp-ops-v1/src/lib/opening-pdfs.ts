const funkydak: [string, string[]][] = [
  ['Kasir', [
    'Menyalakan sistem POS (kasir) dan memastikan perangkat terkoneksi internet dengan stabil.',
    'Menghitung uang modal kembalian (float cash) di dalam laci kasir dan mencatat angkanya di buku log harian.',
    'Menghidupkan mesin EDC, memastikannya beroperasi normal, dan mengelap display QRIS.',
    'Memastikan kertas struk (thermal paper) terpasang penuh dan menyiapkan minimal dua gulungan cadangan.',
    'Mengecek ketersediaan, kelengkapan varian, dan kerapian susunan stok minuman di dalam chiller.',
    'Menyalakan musik playlist standar operasional (upbeat/chill) dengan volume yang nyaman.',
    'Mengelap permukaan meja counter, layar POS, dan merapikan susunan buku menu.',
    'Berkoordinasi dengan dapur dan helper untuk memblokir (sold out) menu jika bahan kosong, dan segera menyalakan kembali menu (available) di sistem jika bahan baku sudah kembali ready.'
  ]],
  ['Helper', [
    'Menyapu dan mengepel seluruh lantai area dine-in, memastikan tidak ada sisa noda minyak atau debu dari semalam.',
    'Mengelap seluruh permukaan kaca area dine-in (bagian luar maupun dalam) menggunakan cairan pembersih hingga jernih dan bebas dari bercak sidik jari.',
    'Menata ulang susunan meja dan kursi sesuai layout standar FunkyDak.',
    'Mengecek dan mengisi penuh kelengkapan condiment (tisu, saus, cutlery, dan sedotan) di station depan.',
    'Membersihkan toilet secara menyeluruh: menyikat lantai, mengelap cermin, serta memastikan sabun dan tisu terisi penuh.',
    'Memastikan seluruh tempat sampah kosong, bersih, dan sudah dilapisi plastik sampah baru.',
    'Menyalakan AC dan lampu area depan 15 menit sebelum pintu restoran resmi dibuka.',
    'Menghidupkan mesin kopi dan mesin waffle agar mencapai suhu ideal sebelum beroperasi.',
    'Mengecek kelayakan bahan baku minuman dan adonan waffle (aroma, tekstur, visual, dan rasa) untuk memastikan semuanya masih segar dan layak jual.',
    'Berkoordinasi dengan kasir untuk menonaktifkan menu di sistem apabila ada menu beverage atau adonan yang sedang kosong/habis.',
    'Menata stok packaging harian (cup minuman, kantong kertas, kardus) agar mudah dijangkau saat packing pesanan takeaway.'
  ]],
  ['Kitchen', [
    'Menghidupkan exhaust fan sebelum menyalakan alat pemanas apa pun.',
    'Menyalakan deep fryer dan memastikan minyak goreng mencapai suhu ideal SOP sebelum orderan pertama mulai digoreng.',
    'Mengecek kelayakan seluruh bahan baku secara ketat (cek fisik, aroma, warna, dan rasa) untuk memastikan tidak ada bahan yang basi atau tidak layak jual, serta menerapkan rotasi First In First Out (FIFO).',
    'Mengecek sisa persediaan harian secara menyeluruh dan wajib segera melapor jika ada bahan baku yang hampir habis agar tidak menghambat laju penjualan kita hari ini.',
    'Melakukan proses thawing (pencairan bertahap) untuk adonan atau bahan baku beku lainnya.',
    'Mengecek seluruh peralatan dapur dan memastikannya dalam keadaan benar-benar bersih sebelum digunakan untuk memasak pesanan.',
    'Menerapkan kedisiplinan alat kerja: wajib mengelap dan membersihkan peralatan dapur segera sehabis digunakan, lalu langsung mengembalikannya ke tempat semula agar dapur selalu rapi dan alat siap pakai.',
    'Memastikan produksi stok ayam di dalam warmer (etalase) tidak ditumpuk terlalu banyak di awal, agar pelanggan selalu mendapatkan ayam goreng yang fresh sehabis dimasak.',
    'Mengecek tingkat kematangan ayam secara berkala sesuai standar SOP dapur, memastikan warna kulitnya golden brown, krispi maksimal, dan daging tender matang sempurna.',
    'Menata prep station (tepung bumbu, saus, sayuran pelengkap) agar koki bisa bekerja cepat tanpa bolak-balik ke chiller saat jam sibuk.',
    'Memastikan lantai area kerja dapur kering dan tidak licin.'
  ]]
];
const sekar: [string, string[]][] = [
  ['Shift 1 — Kasir', [
    'Absen masuk (Fingerprint / Mobile Attendance)',
    'Nyalakan AC & lampu area operasional',
    'Bersihkan area kasir (Lap kaca display, meja kasir, kaca samping, & kaca pembatas dine in AC / smoking)',
    'Start Shift MokaPOS & EDC (Cek modal awal kasir)',
    'Cek menu online (GoFood, GrabFood, ShopeeFood) & konfirmasi ketersediaan menu ke Kitchen',
    'Cek ketersediaan & kelengkapan peralatan kasir selama operasional',
    'Nyalakan musik sesuai playlist Sekar',
    'Cek HP toko (Periksa pesan WhatsApp masuk dari customer yang memesan online)'
  ]],
  ['Shift 1 — Helper', [
    'Absen masuk', 'Sapu & pel area dine in (Dalam & Luar)', 'Sapu area outdoor secara menyeluruh',
    'Lap meja dining luar & dalam (Wajib dibersihkan ulang setiap kali customer selesai dine-in)',
    'Cek & pastikan kebersihan toilet serta kelengkapan fasilitasnya', 'Menyirami seluruh tanaman area resto',
    'Cek isi botol bumbu (Saos tomat, sambal, & honey chilli), lap bersih jika berdebu/kotor',
    'Bersihkan tray saos dan tray asbak outdoor'
  ]],
  ['Shift 1 — Kitchen', [
    'Absen masuk', 'SAFETY CHECK: Menghidupkan / membuka kran regulator tabung gas',
    'Menyalakan oven dan blower exhaust hood kitchen',
    'Cek ketersediaan bahan baku untuk seluruh lini produksi pizza',
    'Proses produksi pizza display (Siapkan varian display fresh)',
    'Prepare bahan baku yang menipis (Cek & terima kedatangan bahan pasar / supplier)',
    'Mencatat restock & pemakaian bahan baku Shift 1 Kitchen'
  ]]
];
export type OpeningPdfSource = 'funkydak' | 'sekar-shift1';

export function openingPdfTemplates(source: OpeningPdfSource, outlet: Record<string, string>): Record<string, string>[] {
  const name = (outlet.outlet_name ?? '').trim().toLowerCase().replace(/\s+/g, '');
  const valid = source === 'funkydak' ? name === 'funkydakcolombo' : ['sekarpizzacolombo', 'sekarpizzatirtodipuran'].includes(name);
  if (!valid || !outlet.outlet_id || !outlet.brand_id || !['active', '1'].includes((outlet.status ?? '').trim().toLowerCase())) throw new Error('PDF requires its verified active outlet and brand');
  return (source === 'funkydak' ? funkydak : sekar).flatMap(([department, items]) => items.map((checklist_item, index) => ({
    checklist_template_id: `CT-PDF-${source}-${outlet.outlet_id}-${department.split(' ').pop()}-${index + 1}`,
    brand_id: outlet.brand_id, outlet_id: outlet.outlet_id, checklist_type: 'OPENING',
    department, checklist_item, required_photo: 'false', critical_flag: 'false', target_value: '', tolerance_value: '', active_status: 'active'
  })));
}
