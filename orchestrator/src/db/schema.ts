import { pgTable, text, integer, timestamp, boolean, jsonb, pgEnum, index, uniqueIndex, numeric } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('user_role', ['owner', 'manager', 'finance', 'hr', 'staff', 'trader']);
export const signalEnum = pgEnum('signal_type', [
  'HTF_BIAS_BULL', 'HTF_BIAS_BEAR',
  'DOL_BUY', 'DOL_SELL',
  'SWEEP_SSL', 'SWEEP_BSL',
  'MSS_BULL', 'MSS_BEAR',
  'IFVG_BULL', 'IFVG_BEAR',
  'SMT_BULL', 'SMT_BEAR',
  'SILVER_BULLET_TIME'
]);
export const setupStatusEnum = pgEnum('setup_status', [
  'WAIT', 'VALID_SETUP', 'PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'CLOSED', 'EXPIRED'
]);
export const severityEnum = pgEnum('alert_severity', ['low', 'medium', 'high']);
export const logLevelEnum = pgEnum('log_level', ['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
export const knowledgeStatusEnum = pgEnum('knowledge_status', ['pending', 'indexed', 'failed']);
export const approvalDecisionEnum = pgEnum('approval_decision', ['approved', 'rejected']);

// Users + roles
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  telegramId: text('telegram_id').unique(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull().default('staff'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// Master data: brands + outlets (PRD §16 subset)
export const brands = pgTable('brands', {
  brandId: text('brand_id').primaryKey(),
  brandName: text('brand_name').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const outlets = pgTable('outlets', {
  outletId: text('outlet_id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brands.brandId),
  outletName: text('outlet_name').notNull(),
  location: text('location').notNull().default(''),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// Employees + attendance
export const employees = pgTable('employees', {
  employeeId: text('employee_id').primaryKey(),
  fullName: text('full_name').notNull(),
  position: text('position').notNull().default('staff'),
  outletId: text('outlet_id').notNull().references(() => outlets.outletId),
  telegramId: text('telegram_id').default(''),
  baseSalary: integer('base_salary').notNull().default(0),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const attendance = pgTable('attendance', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.employeeId),
  date: text('date').notNull(),
  checkIn: text('check_in').notNull().default(''),
  checkOut: text('check_out').notNull().default(''),
  lateMinutes: integer('late_minutes').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  empDateIdx: uniqueIndex('att_emp_date_idx').on(t.employeeId, t.date)
}));

// Sales + expenses (operational, NOT read by Hermez)
export const sales = pgTable('sales', {
  id: text('id').primaryKey(),
  outletId: text('outlet_id').notNull().references(() => outlets.outletId),
  date: text('date').notNull(),
  grossSales: integer('gross_sales').notNull().default(0),
  netSales: integer('net_sales').notNull().default(0),
  transactionCount: integer('transaction_count').notNull().default(0),
  source: text('source').notNull().default('pos'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  outletDateIdx: index('sales_outlet_date_idx').on(t.outletId, t.date)
}));

export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(),
  outletId: text('outlet_id').notNull().references(() => outlets.outletId),
  date: text('date').notNull(),
  category: text('category').notNull(),
  amount: integer('amount').notNull(),
  note: text('note').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// SOP + recipes + memory (long-term)
export const sopDocuments = pgTable('sop_documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull().default('general'),
  content: text('content').notNull(),
  version: text('version').notNull().default('1.0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const recipes = pgTable('recipes', {
  id: text('id').primaryKey(),
  menuName: text('menu_name').notNull(),
  brand: text('brand').notNull(),
  ingredients: jsonb('ingredients').notNull().$type<{ name: string; qty: number; unit: string }[]>(),
  steps: jsonb('steps').notNull().$type<string[]>(),
  hpp: integer('hpp').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const memory = pgTable('memory', {
  id: text('id').primaryKey(),
  scope: text('scope').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  scopeKeyIdx: uniqueIndex('memory_scope_key_idx').on(t.scope, t.key)
}));

// Trading: alerts raw + setups derived + journal manual
export const tradingAlerts = pgTable('trading_alerts', {
  id: text('id').primaryKey(),
  pair: text('pair').notNull(),
  timeframe: text('timeframe').notNull(),
  signal: signalEnum('signal').notNull(),
  price: text('price').notNull(),
  session: text('session').notNull().default(''),
  rawPayload: jsonb('raw_payload').notNull(),
  barIndex: integer('bar_index'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  pairTfIdx: index('ta_pair_tf_idx').on(t.pair, t.timeframe),
  createdAtIdx: index('ta_created_at_idx').on(t.createdAt)
}));

export const tradingSetups = pgTable('trading_setups', {
  id: text('id').primaryKey(),
  pair: text('pair').notNull(),
  timeframe: text('timeframe').notNull(),
  bias: text('bias').notNull(),
  session: text('session').notNull(),
  status: setupStatusEnum('status').notNull().default('WAIT'),
  steps: jsonb('steps').notNull().$type<Record<string, string>>(),
  // HERMES Phase 1 enrichments
  entryPrice: numeric('entry_price'),
  sl: numeric('sl'),
  tp: numeric('tp'),
  rr: numeric('rr'),
  lots: numeric('lots'),
  riskPct: numeric('risk_pct'),
  score: integer('score'),
  reasoning: text('reasoning'),
  agentId: text('agent_id'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  statusIdx: index('ts_status_idx').on(t.status)
}));

export const tradingJournal = pgTable('trading_journal', {
  id: text('id').primaryKey(),
  pair: text('pair').notNull(),
  bias: text('bias').notNull(),
  setupType: text('setup_type').notNull(),
  entry: text('entry').notNull(),
  sl: text('sl').notNull().default(''),
  tp: text('tp').notNull().default(''),
  result: text('result').notNull().default('open'),
  notes: text('notes').notNull().default(''),
  // HERMES Phase 2+3 enrichments
  setupId: text('setup_id'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: text('approved_by'),
  pnlUsd: numeric('pnl_usd'),
  rrActual: numeric('rr_actual'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// AI + system logs
export const aiLogs = pgTable('ai_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  taskType: text('task_type').notNull(),
  modelUsed: text('model_used').notNull(),
  prompt: text('prompt').notNull(),
  response: text('response').notNull(),
  error: text('error').notNull().default(''),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
  costUsd: text('cost_usd').notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  createdAtIdx: index('ai_logs_created_idx').on(t.createdAt)
}));

export const systemLogs = pgTable('system_logs', {
  id: text('id').primaryKey(),
  service: text('service').notNull(),
  level: logLevelEnum('level').notNull().default('info'),
  message: text('message').notNull(),
  meta: jsonb('meta').notNull().$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  serviceCreatedIdx: index('sys_logs_service_created_idx').on(t.service, t.createdAt)
}));

// Daily summaries + Hermez alerts (Hermez layer, derived from raw)
export const dailyBriefs = pgTable('daily_briefs', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  briefText: text('brief_text').notNull(),
  sentToOwner: boolean('sent_to_owner').notNull().default(false),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const hermezAlerts = pgTable('hermez_alerts', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  alertType: text('alert_type').notNull(),
  severity: severityEnum('severity').notNull().default('low'),
  outletId: text('outlet_id').notNull().default(''),
  message: text('message').notNull(),
  resolved: boolean('resolved').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const backups = pgTable('backups', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  path: text('path').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  status: text('status').notNull().default('success'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// HERMES — Knowledge base
export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  source: text('source').notNull().default('manual'),
  title: text('title').notNull(),
  url: text('url').default(''),
  path: text('path').default(''),
  status: knowledgeStatusEnum('status').notNull().default('pending'),
  chunks: integer('chunks').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  categoryIdx: index('kd_category_idx').on(t.category)
}));

export const knowledgeChunks = pgTable('knowledge_chunks', {
  id: text('id').primaryKey(),
  docId: text('doc_id').notNull().references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
  chunkIdx: integer('chunk_idx').notNull(),
  content: text('content').notNull(),
  tokens: integer('tokens').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  docIdx: index('kc_doc_idx').on(t.docId),
  docChunkIdx: uniqueIndex('kc_doc_chunk_idx').on(t.docId, t.chunkIdx)
}));

// HERMES — News / economic calendar
export const newsEvents = pgTable('news_events', {
  id: text('id').primaryKey(),
  pair: text('pair').notNull().default(''),
  currency: text('currency').notNull(),
  title: text('title').notNull(),
  impact: severityEnum('impact').notNull().default('medium'),
  ts: timestamp('ts', { withTimezone: true }).notNull(),
  source: text('source').notNull().default('stub'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  pairTsIdx: index('ne_pair_ts_idx').on(t.pair, t.ts)
}));

// HERMES — 5 agent sessions (light-weight KV)
export const agentSessions = pgTable('agent_sessions', {
  id: text('id').primaryKey(),
  agent: text('agent').notNull(),
  userId: text('user_id').default(''),
  topic: text('topic').notNull(),
  messages: jsonb('messages').notNull().$type<{ role: 'user' | 'assistant'; content: string; ts: string }[]>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// HERMES Phase 2 — Manual approval
export const tradingApprovals = pgTable('trading_approvals', {
  id: text('id').primaryKey(),
  setupId: text('setup_id').notNull().references(() => tradingSetups.id),
  decidedBy: text('decided_by').default(''),
  decision: approvalDecisionEnum('decision'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  reason: text('reason').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  setupIdx: uniqueIndex('ta_setup_idx').on(t.setupId)
}));

// HERMES Phase 3 — Trade executions, audit, bridge failures
export const tradeExecutions = pgTable('trade_executions', {
  id: text('id').primaryKey(),
  setupId: text('setup_id').notNull().references(() => tradingSetups.id),
  orderId: text('order_id').default(''),
  pair: text('pair').notNull(),
  side: text('side').notNull(),
  entry: numeric('entry'),
  sl: numeric('sl'),
  tp: numeric('tp'),
  lots: numeric('lots'),
  status: text('status').notNull().default('pending'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  result: text('result').default(''),
  pnlUsd: numeric('pnl_usd'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  raw: jsonb('raw').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  setupIdx: index('te_setup_idx').on(t.setupId)
}));

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  meta: jsonb('meta').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  entityIdx: index('al_entity_idx').on(t.entity, t.entityId)
}));

export const bridgeFailures = pgTable('bridge_failures', {
  id: text('id').primaryKey(),
  bridge: text('bridge').notNull(),
  endpoint: text('endpoint').notNull(),
  error: text('error').notNull(),
  meta: jsonb('meta').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  bridgeIdx: index('bf_bridge_idx').on(t.bridge)
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type TradingAlert = typeof tradingAlerts.$inferSelect;
export type TradingSetup = typeof tradingSetups.$inferSelect;
export type SopDocument = typeof sopDocuments.$inferSelect;
export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewsEvent = typeof newsEvents.$inferSelect;
export type AgentSession = typeof agentSessions.$inferSelect;
export type TradingApproval = typeof tradingApprovals.$inferSelect;
export type TradeExecution = typeof tradeExecutions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type BridgeFailure = typeof bridgeFailures.$inferSelect;
