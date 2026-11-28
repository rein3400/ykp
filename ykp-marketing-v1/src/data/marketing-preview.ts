/**
 * Seed data for the Marketing PREVIEW (no backend). Mirrors the reference
 * "02 / Marketing": Panduan Meta + Arahan Konten with honest provenance.
 * Clearly labeled as simulation — never production data.
 */

export type BrandName =
  | 'Funkydak'
  | 'Sekar Pizza'
  | 'Suburbuns'
  | 'Laju Kopi'
  | 'Uncle Masala';

export const BRANDS: BrandName[] = [
  'Funkydak',
  'Sekar Pizza',
  'Suburbuns',
  'Laju Kopi',
  'Uncle Masala'
];

export interface MetaGuideItem {
  id: string;
  title: string;
  source: string;
  body: string;
  version: string;
  done: boolean;
}

export const META_GUIDE_ITEMS: MetaGuideItem[] = [
  {
    id: 'review-account',
    title: 'Tinjau panduan akun',
    source: 'Panduan resmi Meta',
    body: 'Baca Best Practices di Professional Dashboard dan catat saran yang berlaku pada akun brand.',
    version: 'Versi 1',
    done: false
  },
  {
    id: 'posting-frequency',
    title: 'Frekuensi posting',
    source: 'Target internal - usulan',
    body: 'Usulan awal: 3 konten per brand per minggu. Sesuaikan dengan kapasitas dan evaluasi hasil.',
    version: 'Versi 1',
    done: false
  }
];

export interface ContentReference {
  id: string;
  category: string;
  brand: BrandName;
  heading: string;
  summary: string;
  sourceName: string;
  originalPostDate: string;
  metadataCheckedAt: string;
  performance: 'belum tersedia' | string;
  evidence: 'bukti terbatas';
}

export const CONTENT_REFERENCES: ContentReference[] = [
  {
    id: 'sekar-pizza',
    category: 'PIZZA',
    brand: 'Sekar Pizza',
    heading: 'Dari adonan ke slice pertama',
    summary:
      'Topik pizza cocok untuk menguji cerita proses dan pengalaman makan slice Sekar Pizza.',
    sourceName: 'ENROEVAS',
    originalPostDate: '12 Jun 2026',
    metadataCheckedAt: '21 Nov 2026',
    performance: 'belum tersedia',
    evidence: 'bukti terbatas'
  },
  {
    id: 'suburbuns-burger',
    category: 'BURGER',
    brand: 'Suburbuns',
    heading: 'Dengar grill-nya. Lihat crust-nya.',
    summary:
      'Deskripsi membagi proses smash burger menjadi tahap yang jelas, berguna sebagai pembanding urutan produksi Suburbuns.',
    sourceName: 'Cookist',
    originalPostDate: '14 Jul 2026',
    metadataCheckedAt: '21 Nov 2026',
    performance: 'belum tersedia',
    evidence: 'bukti terbatas'
  }
];

export const DISCLAIMERS = {
  meta: 'Tujuan: memperbesar peluang jangkauan dan traffic. Hasil FYP tidak dijanjikan.',
  reference:
    'Tautan asli ditemukan, tetapi tren terkini belum bisa diverifikasi. Tidak ada klaim akses ke seluruh FYP. Angka snapshot lama hanya ditampilkan di detail.'
} as const;
