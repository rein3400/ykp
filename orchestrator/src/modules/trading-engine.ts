import { db, schema } from '../db/index.js';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { redis } from '../services/redis.js';
import { sendToOwner } from './telegram-bot.js';
import { env } from '../config/env.js';
import { RISK_LIMITS } from '../config/constants.js';
import { logger } from '../services/logger.js';
import { nanoid } from 'nanoid';
import { scoreSetup } from './scoring.js';
import { computeRisk } from './risk-manager.js';
import { isInSession } from './session-filter.js';
import { isNewsClear } from './news-filter.js';
import { evaluateHardGates } from './hard-gates.js';

export interface TradingWebhookPayload {
  source: string;
  pair: string;
  timeframe: string;
  signal: string;
  price: string | number;
  session?: string;
  timestamp?: string;
  bar_index?: number;
  /** Optional absolute SL from chart (preferred over default ATR-ish offset). */
  sl?: string | number;
  /** Optional absolute TP from chart (liquidity target). */
  tp?: string | number;
}

interface SetupState {
  pair: string;
  timeframe: string;
  bias: string;
  dolSide: string;
  sweep: string;
  mss: string;
  ifvg: string;
  smt: string;
  silverBullet: boolean;
  premiumDiscount: string;
  pdArray: string;
  updatedAt: number;
}

const TTL_SEC = env.SETUP_TTL_MINUTES * 60;

function stateKey(pair: string, timeframe: string): string {
  return `ykp:setup:${pair}:${timeframe}`;
}

async function loadState(pair: string, timeframe: string): Promise<SetupState> {
  const raw = await redis.get(stateKey(pair, timeframe));
  if (raw) {
    try {
      const s = JSON.parse(raw) as SetupState;
      if (Date.now() - s.updatedAt > TTL_SEC * 1000) {
        return freshState(pair, timeframe);
      }
      return s;
    } catch {
      // fall through
    }
  }
  return freshState(pair, timeframe);
}

function freshState(pair: string, timeframe: string): SetupState {
  return {
    pair,
    timeframe,
    bias: '',
    dolSide: '',
    sweep: '',
    mss: '',
    ifvg: '',
    smt: '',
    silverBullet: false,
    premiumDiscount: '',
    pdArray: '',
    updatedAt: Date.now()
  };
}

async function saveState(s: SetupState): Promise<void> {
  s.updatedAt = Date.now();
  await redis.set(stateKey(s.pair, s.timeframe), JSON.stringify(s), 'EX', TTL_SEC);
}

interface ProcessedAlert {
  status: 'WAIT' | 'VALID_SETUP' | 'REJECTED';
  state: SetupState;
  next: string;
  score?: number;
  setupId?: string;
  hardGates?: string[];
}

/**
 * Count open journal trades for max-concurrent gate.
 * Best-effort: returns 0 if DB unavailable so unit tests without DB still work via try/catch callers.
 */
async function countOpenTrades(pair?: string): Promise<number> {
  try {
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.tradingJournal)
      .where(
        pair
          ? and(eq(schema.tradingJournal.result, 'open'), eq(schema.tradingJournal.pair, pair))
          : eq(schema.tradingJournal.result, 'open')
      );
    return Number(rows[0]?.c ?? 0);
  } catch (err) {
    logger.warn({ err }, 'countOpenTrades failed — assuming 0');
    return 0;
  }
}

/**
 * Rough daily realized PnL % from closed journal rows today (WIB day).
 * Positive = profit, negative = loss. Missing data → 0 (do not block).
 */
async function dailyPnlPct(): Promise<number> {
  try {
    const start = new Date();
    // Approximate WIB midnight: UTC+7
    const wibOffsetMs = 7 * 60 * 60 * 1000;
    const wibNow = new Date(start.getTime() + wibOffsetMs);
    const dayStartUtc = new Date(
      Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate()) - wibOffsetMs
    );
    const rows = await db
      .select()
      .from(schema.tradingJournal)
      .where(gte(schema.tradingJournal.createdAt, dayStartUtc));
    // Journal has no pnl column in all schemas — sum score-proxy only when notes encode pnl=
    let pnlUsd = 0;
    for (const r of rows) {
      const m = /pnl=(-?\d+(?:\.\d+)?)/i.exec(r.notes ?? '');
      if (m) pnlUsd += Number(m[1]);
    }
    return (pnlUsd / env.RISK_ACCOUNT_USD) * 100;
  } catch (err) {
    logger.warn({ err }, 'dailyPnlPct failed — assuming 0');
    return 0;
  }
}

export async function processAlert(payload: TradingWebhookPayload): Promise<ProcessedAlert> {
  const s = await loadState(payload.pair, payload.timeframe);

  applySignal(s, payload);

  await saveState(s);

  await persistAlert(payload);

  const sessionCheck = isInSession(new Date(), payload.session);
  const newsCheck = await isNewsClear(payload.pair);

  const structurallyComplete = isStructureComplete(s);

  if (!structurallyComplete) {
    const next = nextStep(s);
    await persistSetup(s, 'WAIT', undefined);
    await sendToOwner(formatWait(s, payload, next));
    return { status: 'WAIT', state: s, next };
  }

  // Structure complete — plan entry/SL/TP then hard-gate + score
  const entryPrice = Number(payload.price);
  const planned = planEntryLevels(s, entryPrice, payload);

  const hard = evaluateHardGates({
    sweep: s.sweep,
    mss: s.mss,
    ifvg: s.ifvg,
    bias: s.bias,
    sessionOk: sessionCheck.inSession,
    newsOk: newsCheck.ok,
    rr: planned.rr,
    minRr: RISK_LIMITS.MIN_RR
  });

  if (!hard.ok) {
    const reason = hard.failed.map((f) => hard.reasons[f] ?? f).join(' · ');
    await persistSetup(s, 'WAIT', undefined);
    await sendToOwner(formatWaitWithScore(s, payload, `HARD GATE: ${reason}`));
    return {
      status: 'REJECTED',
      state: s,
      next: reason,
      hardGates: hard.failed
    };
  }

  const sc = scoreSetup({
    bias: s.bias,
    dolSide: s.dolSide,
    sweep: s.sweep,
    mss: s.mss,
    ifvg: s.ifvg,
    smt: s.smt,
    silverBullet: s.silverBullet || sessionCheck.silverBullet,
    premiumDiscount: s.premiumDiscount,
    pdArray: s.pdArray,
    sessionOk: sessionCheck.inSession,
    newsOk: newsCheck.ok,
    rr: planned.rr
  });

  if (!sc.passed) {
    const reason = `score ${sc.score} < threshold ${env.SCORE_THRESHOLD}`;
    await persistSetup(s, 'WAIT', sc.score);
    await sendToOwner(formatWaitWithScore(s, payload, reason, sc.score));
    return { status: 'WAIT', state: s, next: reason, score: sc.score };
  }

  const openTrades = await countOpenTrades();
  const dayPnl = await dailyPnlPct();

  let risk;
  try {
    risk = computeRisk({
      entry: entryPrice,
      sl: planned.sl,
      rrTarget: planned.rr,
      score: sc.score,
      openTrades,
      dailyPnlPct: dayPnl
    });
  } catch (err) {
    logger.warn({ err, payload }, 'risk compute failed');
    await persistSetup(s, 'WAIT', sc.score);
    await sendToOwner(formatWaitWithScore(s, payload, 'risk compute failed', sc.score));
    return { status: 'WAIT', state: s, next: 'risk compute failed', score: sc.score };
  }

  if (!risk.allowed) {
    await persistSetup(s, 'WAIT', sc.score);
    await sendToOwner(
      formatWaitWithScore(s, payload, `RISK GATE: ${risk.rejectReason}`, sc.score)
    );
    return {
      status: 'REJECTED',
      state: s,
      next: risk.rejectReason ?? 'risk rejected',
      score: sc.score
    };
  }

  const setupId = `TS-${nanoid(12)}`;
  await persistSetup(s, 'VALID_SETUP', sc.score, {
    setupId,
    entryPrice,
    sl: planned.sl,
    tp: risk.tp,
    rr: risk.rr,
    lots: risk.lots,
    riskPct: risk.riskPct,
    reasoning: buildReasoning(s, sessionCheck.window, sc.score),
    agentId: 'ict_mentor'
  });

  // Phase 2: submit for approval with inline keyboard, then notify summary
  const { submitForApproval } = await import('./approval.js');
  const summary = formatValid(
    s,
    payload,
    sc.score,
    entryPrice,
    planned.sl,
    risk.tp,
    risk.rr,
    risk.lots,
    risk.riskPct,
    sessionCheck.window
  );
  await submitForApproval(setupId, summary);

  await autoJournal(s, payload, entryPrice, planned.sl, risk.tp, setupId);

  return { status: 'VALID_SETUP', state: s, next: 'setup valid', score: sc.score, setupId };
}

/**
 * Plan SL/TP levels.
 * Prefer absolute sl/tp from payload; else place SL 0.5% beyond entry opposite bias
 * (placeholder until PD-array price is supplied by chart). RR forced to strategy min.
 */
function planEntryLevels(
  s: SetupState,
  entry: number,
  payload: TradingWebhookPayload
): { sl: number; tp: number; rr: number } {
  const rr = Math.max(env.RR_TARGET, RISK_LIMITS.MIN_RR);
  let sl: number;
  if (payload.sl !== undefined && Number.isFinite(Number(payload.sl))) {
    sl = Number(payload.sl);
  } else {
    // Fallback offset — not PD-array accurate; chart should send `sl` for production
    const direction = s.bias === 'bull' ? -1 : 1;
    sl = Number((entry + direction * entry * 0.005).toFixed(5));
  }

  let tp: number;
  if (payload.tp !== undefined && Number.isFinite(Number(payload.tp))) {
    tp = Number(payload.tp);
    const distRisk = Math.abs(entry - sl);
    const distReward = Math.abs(tp - entry);
    const actualRr = distRisk > 0 ? distReward / distRisk : 0;
    return { sl, tp, rr: Number(actualRr.toFixed(2)) };
  }

  const dir = entry > sl ? 1 : -1;
  tp = Number((entry + dir * rr * Math.abs(entry - sl)).toFixed(5));
  return { sl, tp, rr };
}

function buildReasoning(s: SetupState, window: string | undefined, score: number): string {
  const parts = [
    `HTF ${s.bias}`,
    s.sweep ? `sweep ${s.sweep}` : '',
    s.mss ? `MSS ${s.mss}` : '',
    s.ifvg ? `IFVG ${s.ifvg}` : '',
    s.pdArray ? `PD ${s.pdArray}` : '',
    s.premiumDiscount ? s.premiumDiscount : '',
    window ? `session ${window}` : '',
    `score ${score}`
  ].filter(Boolean);
  return parts.join(' → ');
}

function applySignal(s: SetupState, payload: TradingWebhookPayload): void {
  switch (payload.signal) {
    case 'HTF_BIAS_BULL':
      s.bias = 'bull';
      break;
    case 'HTF_BIAS_BEAR':
      s.bias = 'bear';
      break;
    case 'DOL_BUY':
      s.dolSide = 'buy';
      break;
    case 'DOL_SELL':
      s.dolSide = 'sell';
      break;
    case 'SWEEP_SSL':
      s.sweep = 'ssl';
      break;
    case 'SWEEP_BSL':
      s.sweep = 'bsl';
      break;
    case 'MSS_BULL':
      // Rule: No Sweep = No MSS
      if (s.sweep) s.mss = 'bull';
      else logger.warn({ pair: payload.pair }, 'MSS_BULL rejected: no sweep yet');
      break;
    case 'MSS_BEAR':
      if (s.sweep) s.mss = 'bear';
      else logger.warn({ pair: payload.pair }, 'MSS_BEAR rejected: no sweep yet');
      break;
    case 'IFVG_BULL':
      // Rule: No MSS = No Trade / No IFVG entry
      if (s.mss === 'bull') s.ifvg = 'bull';
      else logger.warn({ pair: payload.pair }, 'IFVG_BULL rejected: no MSS yet');
      break;
    case 'IFVG_BEAR':
      if (s.mss === 'bear') s.ifvg = 'bear';
      else logger.warn({ pair: payload.pair }, 'IFVG_BEAR rejected: no MSS yet');
      break;
    case 'SMT_BULL':
      s.smt = 'bull';
      break;
    case 'SMT_BEAR':
      s.smt = 'bear';
      break;
    case 'SILVER_BULLET_TIME':
      s.silverBullet = true;
      break;
    case 'PD_PREMIUM':
      s.premiumDiscount = 'premium';
      break;
    case 'PD_DISCOUNT':
      s.premiumDiscount = 'discount';
      break;
    case 'PD_ARRAY_OB':
      s.pdArray = 'ob';
      break;
    case 'PD_ARRAY_BREAKER':
      s.pdArray = 'breaker';
      break;
    case 'PD_ARRAY_FVG':
      s.pdArray = 'fvg';
      break;
    default:
      logger.warn({ signal: payload.signal }, 'unknown signal');
  }
}

/**
 * Structure complete when HTF bias + DOL + Sweep + MSS + IFVG align.
 * Silver Bullet is a quality label (session window), not a hard structure requirement —
 * Kill Zone gate already enforces tradeable session.
 */
function isStructureComplete(s: SetupState): boolean {
  if (!s.bias || !s.dolSide || !s.sweep || !s.mss || !s.ifvg) return false;
  return (
    (s.bias === 'bull' && s.mss === 'bull' && s.ifvg === 'bull') ||
    (s.bias === 'bear' && s.mss === 'bear' && s.ifvg === 'bear')
  );
}

function nextStep(s: SetupState): string {
  if (!s.bias) return 'Tunggu HTF Bias';
  if (!s.dolSide) return 'Tunggu DOL jelas';
  if (!s.sweep) return 'Tunggu Liquidity Sweep (SSL/BSL)';
  if (!s.mss) return 'Tunggu MSS';
  if (!s.ifvg) return 'Tunggu IFVG';
  if (s.bias !== s.mss || s.mss !== s.ifvg) return 'Tunggu alignment bias/MSS/IFVG';
  return 'Struktur lengkap — evaluasi hard gate + score';
}

/** DB pgEnum signal_type — PD_* labels update Redis state only (no migration required). */
const PERSISTABLE_SIGNALS = new Set([
  'HTF_BIAS_BULL',
  'HTF_BIAS_BEAR',
  'DOL_BUY',
  'DOL_SELL',
  'SWEEP_SSL',
  'SWEEP_BSL',
  'MSS_BULL',
  'MSS_BEAR',
  'IFVG_BULL',
  'IFVG_BEAR',
  'SMT_BULL',
  'SMT_BEAR',
  'SILVER_BULLET_TIME'
]);

async function persistAlert(p: TradingWebhookPayload): Promise<void> {
  if (!PERSISTABLE_SIGNALS.has(p.signal)) {
    // Still logged via raw state; avoid pgEnum violation for PD_* / future labels
    logger.debug({ signal: p.signal }, 'skip trading_alerts insert — not in signal_type enum');
    return;
  }
  await db.insert(schema.tradingAlerts).values({
    id: `TA-${nanoid(12)}`,
    pair: p.pair,
    timeframe: p.timeframe,
    signal: p.signal as typeof schema.tradingAlerts.$inferInsert.signal,
    price: String(p.price),
    session: p.session ?? '',
    rawPayload: p as unknown as Record<string, unknown>,
    barIndex: p.bar_index ?? null
  });
}

interface SetupEnrichment {
  setupId: string;
  entryPrice: number;
  sl: number;
  tp: number;
  rr: number;
  lots: number;
  riskPct: number;
  reasoning: string;
  agentId: string;
}

async function persistSetup(
  s: SetupState,
  status: 'WAIT' | 'VALID_SETUP',
  score?: number,
  enr?: SetupEnrichment
): Promise<void> {
  await db.insert(schema.tradingSetups).values({
    id: enr?.setupId ?? `TS-${nanoid(12)}`,
    pair: s.pair,
    timeframe: s.timeframe,
    bias: s.bias || 'none',
    session: '',
    status,
    steps: {
      bias: s.bias,
      dolSide: s.dolSide,
      sweep: s.sweep,
      mss: s.mss,
      ifvg: s.ifvg,
      smt: s.smt,
      silverBullet: String(s.silverBullet),
      premiumDiscount: s.premiumDiscount,
      pdArray: s.pdArray
    },
    entryPrice: enr ? String(enr.entryPrice) : null,
    sl: enr ? String(enr.sl) : null,
    tp: enr ? String(enr.tp) : null,
    rr: enr ? String(enr.rr) : null,
    lots: enr ? String(enr.lots) : null,
    riskPct: enr ? String(enr.riskPct) : null,
    score: score ?? null,
    reasoning: enr?.reasoning ?? null,
    agentId: enr?.agentId ?? null,
    expiresAt: new Date(Date.now() + TTL_SEC * 1000)
  });
}

function formatValid(
  s: SetupState,
  p: TradingWebhookPayload,
  score: number,
  entry: number,
  sl: number,
  tp: number,
  rr: number,
  lots: number,
  riskPct: number,
  window?: string
): string {
  const setupLabel = s.silverBullet
    ? 'SRI ICT Silver Bullet'
    : s.pdArray === 'breaker'
      ? 'Breaker retest'
      : s.pdArray === 'ob'
        ? 'OB continuation'
        : 'SRI ICT Setup';
  return `<b>HERMES ICT VALID SETUP</b>
Pair: ${p.pair} (${p.timeframe})
Bias: ${s.bias === 'bull' ? 'BUY' : 'SELL'}
Session: ${window ?? p.session ?? '-'}
Sweep: ${s.sweep === 'ssl' ? 'SSL taken' : 'BSL taken'}
MSS: ${s.mss} confirmed
IFVG: ${s.ifvg} confirmed
SMT: ${s.smt || '-'}
PD: ${s.premiumDiscount || '-'} / ${s.pdArray || '-'}
DOL: ${s.dolSide === 'buy' ? 'Buy Side' : 'Sell Side'}

<b>Entry Plan</b>
Setup: ${setupLabel}
Alasan: ${buildReasoning(s, window, score)}
Entry: ${entry}
SL: ${sl}
TP: ${tp}
RR: 1:${rr}
Lots: ${lots}
Risk/Trade: ${riskPct}% (${env.RISK_ACCOUNT_USD} USD acct)
Score: ${score}/100 (threshold ${env.SCORE_THRESHOLD}${score >= RISK_LIMITS.FULL_RISK_SCORE ? ', A+' : ''})
Status: VALID_SETUP

<i>Hard gates passed · Phase 2 approval gates execution.</i>`;
}

function formatWait(s: SetupState, p: TradingWebhookPayload, next: string): string {
  return `<b>HERMES ICT UPDATE</b>
Pair: ${p.pair} (${p.timeframe})
Signal: ${p.signal}
Session: ${p.session ?? '-'}
Status: WAIT
Next: ${next}
Rule: No Sweep → No MSS → No IFVG = No Entry`;
}

function formatWaitWithScore(
  s: SetupState,
  p: TradingWebhookPayload,
  reason: string,
  score?: number
): string {
  const scoreLine = typeof score === 'number' ? `\nScore: ${score}/100` : '';
  return `<b>HERMES ICT UPDATE — WAIT</b>
Pair: ${p.pair} (${p.timeframe})
Signal: ${p.signal}
Status: WAIT${scoreLine}
Reason: ${reason}
Rules: Hard gates first · score ≥ ${env.SCORE_THRESHOLD} · RR ≥ 1:${RISK_LIMITS.MIN_RR}`;
}

async function autoJournal(
  s: SetupState,
  p: TradingWebhookPayload,
  entry: number,
  sl: number,
  tp: number,
  setupId: string
): Promise<void> {
  await db.insert(schema.tradingJournal).values({
    id: `TJ-${nanoid(12)}`,
    pair: p.pair,
    bias: s.bias === 'bull' ? 'BUY' : 'SELL',
    setupType: s.silverBullet ? 'SRI ICT Silver Bullet' : 'SRI ICT Setup',
    entry: String(entry),
    sl: String(sl),
    tp: String(tp),
    result: 'open',
    setupId,
    notes: `Auto from webhook. session=${p.session ?? '-'} mss=${s.mss} ifvg=${s.ifvg} pd=${s.pdArray}`
  });
}

export async function handleTrading(): Promise<string> {
  const recent = await db
    .select()
    .from(schema.tradingSetups)
    .orderBy(desc(schema.tradingSetups.createdAt))
    .limit(5);
  if (recent.length === 0) return 'Belum ada setup trading.';
  const lines = recent.map(
    (r) =>
      `${r.pair} ${r.timeframe} — ${r.status} (${r.bias})${r.score ? ` score=${r.score}` : ''}`
  );
  return `TRADING SETUP TERAKHIR:\n${lines.join('\n')}`;
}
