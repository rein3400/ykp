import { db, schema } from '../db/index.js';
import { eq, gte, lte, sql, and } from 'drizzle-orm';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays } from 'date-fns';
import { TIMEZONE } from '../config/constants.js';

function todayWIB(): string { return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd'); }

export async function handleFinance(args: string): Promise<string> {
  if (args.includes('hari ini')) return handleFinanceDay(todayWIB());
  if (args.includes('minggu ini') || args.includes('week')) return handleFinanceWeek();
  if (args.includes('bulan') || args.includes('month')) return handleFinanceMonth();
  return handleFinanceWeek();
}

async function handleFinanceDay(date: string): Promise<string> {
  const salesRows = await db.select({
    salesTotal: sql<number>`COALESCE(SUM(${schema.sales.netSales}),0)`
  }).from(schema.sales).where(eq(schema.sales.date, date));
  const expenseRows = await db.select({
    expenseTotal: sql<number>`COALESCE(SUM(${schema.expenses.amount}),0)`
  }).from(schema.expenses).where(eq(schema.expenses.date, date));
  const sales = Number(salesRows[0]?.salesTotal ?? 0);
  const expense = Number(expenseRows[0]?.expenseTotal ?? 0);
  const profit = sales - expense;
  const margin = sales > 0 ? Math.round((profit / sales) * 100) : 0;
  return `<b>FINANCE ${date}</b>
Omzet: Rp${sales.toLocaleString('id-ID')}
Expense: Rp${expense.toLocaleString('id-ID')}
Gross Profit: Rp${profit.toLocaleString('id-ID')}
Margin: ${margin}%`;
}

async function handleFinanceWeek(): Promise<string> {
  const today = todayWIB();
  const startDate = formatInTimeZone(subDays(new Date(), 6), TIMEZONE, 'yyyy-MM-dd');
  return handleFinanceRange(startDate, today, 'MINGGU');
}

async function handleFinanceMonth(): Promise<string> {
  const today = todayWIB();
  const startDate = formatInTimeZone(subDays(new Date(), 29), TIMEZONE, 'yyyy-MM-dd');
  return handleFinanceRange(startDate, today, 'BULAN');
}

async function handleFinanceRange(start: string, end: string, label: string): Promise<string> {
  const salesRows = await db.select({
    salesTotal: sql<number>`COALESCE(SUM(${schema.sales.netSales}),0)`
  }).from(schema.sales).where(and(gte(schema.sales.date, start), lte(schema.sales.date, end)));
  const expenseRows = await db.select({
    expenseTotal: sql<number>`COALESCE(SUM(${schema.expenses.amount}),0)`
  }).from(schema.expenses).where(and(gte(schema.expenses.date, start), lte(schema.expenses.date, end)));
  const sales = Number(salesRows[0]?.salesTotal ?? 0);
  const expense = Number(expenseRows[0]?.expenseTotal ?? 0);
  const profit = sales - expense;
  const margin = sales > 0 ? Math.round((profit / sales) * 100) : 0;
  return `<b>FINANCE REPORT ${label}</b>
Periode: ${start} s/d ${end}
Omzet: Rp${sales.toLocaleString('id-ID')}
Expense: Rp${expense.toLocaleString('id-ID')}
Gross Profit: Rp${profit.toLocaleString('id-ID')}
Margin: ${margin}%`;
}