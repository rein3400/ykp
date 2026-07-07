import { db, schema } from '../db/index.js';
import { eq, desc, gt, and } from 'drizzle-orm';
import { formatInTimeZone } from 'date-fns-tz';
import { TIMEZONE } from '../config/constants.js';

function todayWIB(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

export async function handleHr(args: string): Promise<string> {
  if (args.includes('telat') || args.includes('late')) {
    return handleLateToday();
  }
  if (args.includes('absensi') || args.includes('attendance')) {
    return handleAttendance();
  }
  return handleLateToday();
}

async function handleLateToday(): Promise<string> {
  const date = todayWIB();
  const rows = await db.select({
    fullName: schema.employees.fullName,
    lateMinutes: schema.attendance.lateMinutes
  }).from(schema.attendance)
    .innerJoin(schema.employees, eq(schema.attendance.employeeId, schema.employees.employeeId))
    .where(and(eq(schema.attendance.date, date), gt(schema.attendance.lateMinutes, 0)))
    .orderBy(desc(schema.attendance.lateMinutes))
    .limit(20);

  if (rows.length === 0) return `Tidak ada karyawan telat pada ${date}.`;
  const lines = rows.map((r, i) => `${i + 1}. ${r.fullName} — ${r.lateMinutes} menit`);
  return `KARYAWAN TELAT ${date}\n${lines.join('\n')}`;
}

async function handleAttendance(): Promise<string> {
  const date = todayWIB();
  const rows = await db.select({
    fullName: schema.employees.fullName,
    checkIn: schema.attendance.checkIn,
    lateMinutes: schema.attendance.lateMinutes
  }).from(schema.attendance)
    .innerJoin(schema.employees, eq(schema.attendance.employeeId, schema.employees.employeeId))
    .where(eq(schema.attendance.date, date))
    .limit(20);
  if (rows.length === 0) return `Belum ada data absensi ${date}.`;
  const lines = rows.map((r) => `${r.fullName} — in ${r.checkIn || '-'} (telat ${r.lateMinutes}m)`);
  return `ABSENSI ${date}\n${lines.join('\n')}`;
}