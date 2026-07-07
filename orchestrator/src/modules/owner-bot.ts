import { db, schema } from '../db/index.js';
import { eq, gte, lte, sql, and, desc } from 'drizzle-orm';
import { redisPing } from '../services/redis.js';
import { formatInTimeZone } from 'date-fns-tz';
import { TIMEZONE } from '../config/constants.js';
import { handleHr } from './hr-bot.js';

function todayWIB(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(formatInTimeZone(d, TIMEZONE, 'yyyy-MM-dd'));
  }
  return days;
}

export async function handleStatus(): Promise<string> {
  const pgOk = await db.execute(sql`SELECT 1`).then(() => true).catch(() => false);
  const redisOk = await redisPing();
  return `<b>YKP SERVER STATUS</b>
API: OK
PostgreSQL: ${pgOk ? 'OK' : 'DOWN'}
Redis: ${redisOk ? 'OK' : 'DOWN'}
Disk: (n/a — dev mode)
RAM: (n/a — dev mode)
Last Backup: 03:00 WIB`;
}

export async function handleOmzet(args: string): Promise<string> {
  const date = args.includes('kemarin')
    ? formatInTimeZone(new Date(Date.now() - 86400000), TIMEZONE, 'yyyy-MM-dd')
    : todayWIB();
  const rows = await db.select({
    outletName: schema.outlets.outletName,
    netSales: sql<number>`COALESCE(SUM(${schema.sales.netSales}),0)`
  }).from(schema.sales)
    .innerJoin(schema.outlets, eq(schema.sales.outletId, schema.outlets.outletId))
    .where(eq(schema.sales.date, date))
    .groupBy(schema.outlets.outletName);

  if (rows.length === 0) {
    return `OMZET ${date}\nBelum ada data sales.`;
  }
  const total = rows.reduce((acc, r) => acc + Number(r.netSales), 0);
  const lines = rows.map((r) => `${r.outletName}: Rp${Number(r.netSales).toLocaleString('id-ID')}`);
  return `OMZET ${date}\n${lines.join('\n')}\nTotal: Rp${total.toLocaleString('id-ID')}`;
}

export async function handleReport(): Promise<string> {
  const date = todayWIB();
  const omzet = await handleOmzet('hari ini');
  const late = await handleHr('telat hari ini');
  return `<b>REPORT ${date}</b>\n\n${omzet}\n\n${late}`;
}