import { db, schema } from './index.js';
import { nanoid } from 'nanoid';

async function main() {
  console.log('Seeding...');

  const brands = [
    { brandId: 'BR-001', brandName: 'Funkydak', status: 'active' },
    { brandId: 'BR-002', brandName: 'Sekarpizza', status: 'active' },
    { brandId: 'BR-003', brandName: 'Laju Kopi', status: 'active' }
  ];
  for (const b of brands) {
    await db.insert(schema.brands).values(b).onConflictDoNothing();
  }

  const outlets = [
    { outletId: 'OL-001', brandId: 'BR-001', outletName: 'Funkydak Sudirman', location: 'Jakarta' },
    { outletId: 'OL-002', brandId: 'BR-002', outletName: 'Sekarpizza Kemang', location: 'Jakarta' },
    { outletId: 'OL-003', brandId: 'BR-003', outletName: 'Laju Kopi Bandung', location: 'Bandung' }
  ];
  for (const o of outlets) {
    await db.insert(schema.outlets).values(o).onConflictDoNothing();
  }

  const ownerId = 'USR-OWNER';
  await db.insert(schema.users).values({
    id: ownerId,
    telegramId: process.env.TELEGRAM_OWNER_CHAT_ID ?? null,
    name: 'Owner YKP',
    role: 'owner',
    isActive: true
  }).onConflictDoNothing();

  const sopId = `SOP-${nanoid(8)}`;
  await db.insert(schema.sopDocuments).values({
    id: sopId,
    title: 'Handle Komplain Makanan Terlambat',
    category: 'service',
    content: '1. Minta maaf kepada pelanggan.\n2. Cek status order ke kitchen.\n3. Beri estimasi waktu baru yang jelas.\n4. Jika delay > 20 menit, tawarkan kompensasi sesuai matrix (free dessert / discount 10%).\n5. Catat komplain di laporan shift (waktu, item, durasi delay, kompensasi).',
    version: '1.0',
    isActive: true
  });

  console.log('Seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});