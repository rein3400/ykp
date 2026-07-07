import { db, schema } from '../db/index.js';
import { desc } from 'drizzle-orm';
import { redis } from '../services/redis.js';
import { sendToOwner } from './telegram-bot.js';
import { env } from '../config/env.js';
import { logger } from '../services/logger.js';
import { nanoid } from 'nanoid';
import { scoreSetup } from './scoring.js';
import { computeRisk } from './risk-manager.js';
import { isInSession } from './session-filter.js';
import { isNewsClear } from './news-filter.js';

export interface TradingWebhookPayload {
  source: string;
  pair: string;
  timeframe: string;
  signal: string;
  price: string | number;
  session?: string;
  timestamp?: string;
  bar_index?: number;
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
  status: 'WAIT' | 'VALID_SETUP';
  state: SetupState;
  next: string;
  score?: number;
  setupId?: string;
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

  // Structure complete — invoke scoring
  const sc = scoreSetup({
    bias: s.bias,
    dolSide: s.dolSide,
    sweep: s.sweep,
    mss: s.mss,
    ifvg: s.ifvg,
    smt: s.smt,
    silverBullet: s.silverBullet,
    premiumDiscount: s.premiumDiscount,
    pdArray: s.pdArray,
    sessionOk: sessionCheck.inSession,
    newsOk: newsCheck.ok
  });

  if (!sc.passed || !sessionCheck.inSession || !newsCheck.ok) {
    const reason = !sessionCheck.inSession
      ? sessionCheck.reason
      : !newsCheck.ok
        ? `news not clear: ${newsCheck.hint}`
        : !sc.passed
          ? `score ${sc.score} < threshold ${env.SCORE_THRESHOLD}`
          : 'unknown gate';
    await persistSetup(s, 'WAIT', sc.score);
    await sendToOwner(formatWaitWithScore(s, payload, reason, sc.score));
    return { status: 'WAIT', state: s, next: reason, score: sc.score };
  }

  // SCORE passed + SESSION ok → VALID_SETUP, compute risk
  const entryPrice = Number(payload.price);
  const direction = s.bias === 'bull' ? -1 : 1; // SL on opposite side
  const sl = Number((entryPrice + direction * 0.005).toFixed(5));
  let risk;
  try {
    risk = computeRisk({ entry: entryPrice, sl, rrTarget: env.RR_TARGET });
  } catch (err) {
    logger.warn({ err, payload }, 'risk compute failed');
    risk = { lots: 0.01, riskUsd: 0, tp: entryPrice, rr: env.RR_TARGET };
  }

  const setupId = `TS-${nanoid(12)}`;
  await persistSetup(s, 'VALID_SETUP', sc.score, {
    setupId,
    entryPrice,
    sl,
    tp: risk.tp,
    rr: risk.rr,
    lots: risk.lots,
    riskPct: env.RISK_PCT_PER_TRADE,
    reasoning: nextStep(s),
    agentId: 'ict_mentor'
  });

  // Phase 2: submit for approval with inline keyboard, then notify summary
  const { submitForApproval } = await import('./approval.js');
  const summary = formatValid(s, payload, sc.score, entryPrice, sl, risk.tp, risk.rr, risk.lots);
  await submitForApproval(setupId, summary);

  // auto journal open entry pending approval
  await autoJournal(s, payload, entryPrice, sl, risk.tp, setupId);

  return { status: 'VALID_SETUP', state: s, next: 'setup valid', score: sc.score, setupId };
}

function applySignal(s: SetupState, payload: TradingWebhookPayload): void {
  switch (payload.signal) {
    case 'HTF_BIAS_BULL': s.bias = 'bull'; break;
    case 'HTF_BIAS_BEAR': s.bias = 'bear'; break;
    case 'DOL_BUY': s.dolSide = 'buy'; break;
    case 'DOL_SELL': s.dolSide = 'sell'; break;
    case 'SWEEP_SSL': s.sweep = 'ssl'; break;
    case 'SWEEP_BSL': s.sweep = 'bsl'; break;
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
    case 'SMT_BULL': s.smt = 'bull'; break;
    case 'SMT_BEAR': s.smt = 'bear'; break;
    case 'SILVER_BULLET_TIME': s.silverBullet = true; break;
    default:
      logger.warn({ signal: payload.signal }, 'unknown signal');
  }
}

function isStructureComplete(s: SetupState): boolean {
  if (!s.bias || !s.dolSide || !s.sweep || !s.mss || !s.ifvg) return false;
  if (!s.silverBullet) return false;
  return (s.bias === 'bull' && s.mss === 'bull' && s.ifvg === 'bull') ||
         (s.bias === 'bear' && s.mss === 'bear' && s.ifvg === 'bear');
}

function nextStep(s: SetupState): string {
  if (!s.bias) return 'Tunggu HTF Bias';
  if (!s.dolSide) return 'Tunggu DOL jelas';
  if (!s.sweep) return 'Tunggu Liquidity Sweep (SSL/BSL)';
  if (!s.mss) return 'Tunggu MSS';
  if (!s.ifvg) return 'Tunggu IFVG';
  if (!s.silverBullet) return 'Tunggu Silver Bullet Time';
  return 'Tunggu konfirmasi alignment bias/MSS/IFVG';
}

async function persistAlert(p: TradingWebhookPayload): Promise<void> {
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
  lots: number
): string {
  return `<b>HERMES ICT VALID SETUP</b>
Pair: ${p.pair} (${p.timeframe})
Bias: ${s.bias === 'bull' ? 'BUY' : 'SELL'}
Session: ${p.session ?? '-'}
Sweep: ${s.sweep === 'ssl' ? 'SSL taken' : 'BSL taken'}
MSS: ${s.mss} confirmed
IFVG: ${s.ifvg} confirmed
SMT: ${s.smt || '-'}
DOL: ${s.dolSide === 'buy' ? 'Buy Side' : 'Sell Side'}

<b>Entry Plan</b>
Setup: SRI ICT Silver Bullet
Alasan: ${nextStep(s)} → semua confluences terpenuhi
Entry: ${entry}
SL: ${sl}
TP: ${tp}
RR: 1:${rr}
Lots: ${lots}
Risk/Trade: ${env.RISK_PCT_PER_TRADE}% (${env.RISK_ACCOUNT_USD} USD acct)
Score: ${score}/100 (threshold ${env.SCORE_THRESHOLD})
Status: VALID_SETUP

<i>Phase 2 will gate execution on Telegram Approve/Reject.</i>`;
}

function formatWait(s: SetupState, p: TradingWebhookPayload, next: string): string {
  return `<b>HERMES ICT UPDATE</b>
Pair: ${p.pair} (${p.timeframe})
Signal: ${p.signal}
Session: ${p.session ?? '-'}
Status: WAIT
Next: ${next}
Rule: No IFVG = No Entry`;
}

function formatWaitWithScore(s: SetupState, p: TradingWebhookPayload, reason: string, score?: number): string {
  const scoreLine = typeof score === 'number' ? `\nScore: ${score}/100` : '';
  return `<b>HERMES ICT UPDATE — WAIT</b>
Pair: ${p.pair} (${p.timeframe})
Signal: ${p.signal}
Status: WAIT${scoreLine}
Reason: ${reason}
Rules: No Sweep=No MSS · No MSS=No Trade · No IFVG=No Entry`;
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
    setupType: 'SRI ICT Silver Bullet',
    entry: String(entry),
    sl: String(sl),
    tp: String(tp),
    result: 'open',
    setupId,
    notes: `Auto from webhook. session=${p.session ?? '-'} mss=${s.mss} ifvg=${s.ifvg}`
  });
}

export async function handleTrading(): Promise<string> {
  const recent = await db.select().from(schema.tradingSetups).orderBy(desc(schema.tradingSetups.createdAt)).limit(5);
  if (recent.length === 0) return 'Belum ada setup trading.';
  const lines = recent.map((r) => `${r.pair} ${r.timeframe} — ${r.status} (${r.bias})${r.score ? ` score=${r.score}` : ''}`);
  return `TRADING SETUP TERAKHIR:\n${lines.join('\n')}`;
}