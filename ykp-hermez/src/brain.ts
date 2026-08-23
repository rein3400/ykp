/**
 * Hermez chat brain: OpenRouter tool-use agent loop + conversation memory +
 * deterministic slash commands. Owner-only (enforced in index.ts).
 */
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIG, todayWib, nowWib, daysAgoWib } from './config.js';
import { chat, type ChatMessage, type ToolSpec } from './llm.js';
import { TOOL_SPECS, TOOL_HANDLERS } from './tools.js';
import { addRule, deleteRule, listRules } from './watch.js';
import type { Scope } from './actor.js';

const SYSTEM_PROMPT = `Kamu adalah HERMEZ, asisten AI pribadi owner YKP (grup F&B Indonesia, beberapa brand & outlet).
Kamu mengerti SELURUH data perusahaan lewat tools yang tersedia: keuangan, penjualan per item (Moka POS), margin dari resep gudang, stok/inventori, SDM/kehadiran, operasional outlet, investor, audit trail semua aksi user, dan foto bukti.

ATURAN:
- SELALU pakai tools untuk data faktual. JANGAN pernah mengarang angka. Kalau tool kosong/gagal, bilang datanya belum ada.
- Jawab dalam Bahasa Indonesia, ringkas, langsung ke inti. Owner sibuk.
- Format angka uang: Rp dengan titik ribuan (contoh: Rp4.250.000).
- Selalu sebutkan periode/tanggal data yang kamu pakai.
- Kalau diminta review/rekomendasi: kasih angka dulu, baru 2-3 poin rekomendasi konkret. Jujur kalau ada yang jelek — owner butuh kebenaran, bukan basa-basi.
- Kalau ada anomali (lonjakan/penurunan drastis, selisih kas, margin aneh), tunjukkan eksplisit.
- Hari ini: ${todayWib()} (WIB). Untuk "kemarin" pakai ${daysAgoWib(1)}, "minggu ini" pakai ${daysAgoWib(7)} s/d hari ini.
- Kamu BOLEH membuat watch rule kalau owner minta dipantau ("kabari kalau..."). Gunakan create_watch_rule.
- Kamu TIDAK BISA mengubah data perusahaan (read-only). Tolak sopan kalau diminta mengubah/menghapus data.
- Jawab dengan TEKS POLOS saja. JANGAN pakai markdown (**bold**, ## heading) atau HTML (<b>, <i>).`;

// ── Memory (per chat, TTL) ───────────────────────────────────────────

interface MemEntry { messages: ChatMessage[]; touched: number }
const memory = new Map<number, MemEntry>();

function getMemory(chatId: number): ChatMessage[] {
  const e = memory.get(chatId);
  if (!e) return [];
  if (Date.now() - e.touched > CONFIG.memoryTtlMinutes * 60_000) {
    memory.delete(chatId);
    return [];
  }
  return e.messages;
}
function setMemory(chatId: number, messages: ChatMessage[]): void {
  memory.set(chatId, {
    messages: messages.slice(-CONFIG.memoryMaxMessages),
    touched: Date.now()
  });
}

// ── Watch-rule tools (write to hermez's own store, not company data) ──

const WATCH_SPECS: ToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'create_watch_rule',
      description: 'Buat aturan pantau otomatis (owner: "kabari kalau margin X < 30%"). Metrik: margin_item_pct (perlu item), sales_net_total, sales_item_qty (perlu item).',
      parameters: {
        type: 'object',
        properties: {
          metric: { type: 'string', enum: ['margin_item_pct', 'sales_net_total', 'sales_item_qty'] },
          item: { type: 'string', description: 'nama item (untuk metrik per item)' },
          op: { type: 'string', enum: ['<', '>', '<=', '>='] },
          threshold: { type: 'number' },
          note: { type: 'string', description: 'catatan singkat untuk owner' }
        },
        required: ['metric', 'op', 'threshold']
      }
    }
  },
  {
    type: 'function',
    function: { name: 'list_watch_rules', description: 'Lihat semua watch rule aktif.', parameters: { type: 'object', properties: {} } }
  },
  {
    type: 'function',
    function: {
      name: 'delete_watch_rule',
      description: 'Hapus watch rule berdasarkan id (WR-...).',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
    }
  }
];

// ── Tool execution ───────────────────────────────────────────────────

export async function executeTool(name: string, args: Record<string, unknown>, scope: Scope = {}): Promise<unknown> {
  if (name === 'create_watch_rule') {
    return addRule({
      metric: args.metric as 'margin_item_pct',
      item: args.item as string | undefined,
      op: args.op as '<',
      threshold: Number(args.threshold),
      note: String(args.note ?? '')
    });
  }
  if (name === 'list_watch_rules') return listRules();
  if (name === 'delete_watch_rule') return { deleted: await deleteRule(String(args.id ?? '')) };
  const handler = TOOL_HANDLERS[name];
  if (!handler) return { error: `unknown tool: ${name}` };
  return handler(args, scope);
}

const ALL_SPECS = [...TOOL_SPECS, ...WATCH_SPECS];

// ── Agent loop ───────────────────────────────────────────────────────

const MAX_ITERATIONS = 6;

type ChatFn = typeof chat;

export async function agentLoop(messages: ChatMessage[], chatFn: ChatFn = chat, scope: Scope = {}): Promise<string> {
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = await chatFn(messages, ALL_SPECS);
    if (result.toolCalls.length === 0) return result.content;
    messages.push({ role: 'assistant', content: result.content || null, tool_calls: result.toolCalls });
    for (const tc of result.toolCalls) {
      let out: unknown;
      try {
        out = await executeTool(tc.function.name, JSON.parse(tc.function.arguments || '{}'), scope);
      } catch (e) {
        out = { error: e instanceof Error ? e.message : 'tool error' };
      }
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(out)
      });
    }
  }
  return 'Maaf, saya tidak bisa menyelesaikan analisis (terlalu banyak langkah). Coba pertanyaan lebih spesifik.';
}

// ── Slash commands ───────────────────────────────────────────────────

const COMMANDS: Record<string, string> = {
  '/today': `Buat ringkasan lengkap hari ini (${todayWib()}): penjualan, kas, stok, SDM, operasional, alert. Pakai get_overview + get_alerts.`,
  '/sales': `Analisis penjualan 7 hari terakhir: item terlaris, tren, outlet. Pakai get_sales_items.`,
  '/margin': `Analisis margin semua menu 7 hari terakhir: mana yang paling profit, mana yang rugi/aneh. Pakai get_margins.`,
  '/stok': 'Kondisi inventori sekarang: stok kritis, near expiry, waste, yang harus segera dibeli. Pakai get_inventory.',
  '/sdm': `Kondisi SDM hari ini: kehadiran, keterlambatan, outlet mana yang bermasalah. Pakai get_hr.`,
  '/alert': 'Semua alert terbuka dan action yang belum selesai, urut prioritas. Pakai get_alerts.',
  '/audit': `Aktivitas user hari ini di semua modul — tampilkan yang tidak biasa. Pakai get_activity.`,
  '/foto': 'Foto bukti terbaru (timbangan, struk, MOU) dengan link. Pakai get_photos.',
  '/help': 'Tampilkan daftar perintah dan contoh pertanyaan yang bisa dijawab.'
};

const HELP_TEXT = `HERMEZ — Asisten AI Owner

Tanya apa saja (bahasa bebas):
• "gimana cabang Cipete minggu ini?"
• "margin ayam geprek bulan ini?"
• "ada yang aneh gak hari ini?"
• "siapa yang ubah data kemarin?"
• "kabari kalau margin geprek di bawah 30%"

Perintah cepat:
/today /sales /margin /stok /sdm /alert /audit /foto /help

Kirim foto untuk saya analisis.`;

// ── Entry point ──────────────────────────────────────────────────────

export async function handleText(chatId: number, text: string, imageBase64?: string, scope: Scope = {}): Promise<string> {
  const trimmed = text.trim();
  if (trimmed === '/start' || trimmed === '/help') return HELP_TEXT;
  // Management bot has NO pairing flow — access is chat-id/role based only.
  if (/^\/link\b/i.test(trimmed)) {
    return [
      'Bot ini tidak memakai kode pairing. Akses owner/kepala bagian diberikan otomatis lewat chat id Telegram kamu:',
      '',
      '1. Pastikan chat id kamu tercatat di kolom `telegram_id` tabel users (via admin), atau',
      '2. Masuk daftar TELEGRAM_OWNER_IDS / TELEGRAM_ALLOWED_IDS di server.',
      '',
      'Kode pairing hanya ada di bot karyawan (@justatestermaybot) via menu "Hubungkan Telegram" di tiap aplikasi.'
    ].join('\n');
  }

  const history = getMemory(chatId);
  const scopeNote = scope.brandId || scope.outletId
    ? `\n- AKSES TERBATAS: kamu hanya boleh menjawab data untuk ${scope.outletId ? `outlet ${scope.outletId}` : `brand ${scope.brandId}`}. Jangan sebut data brand/outlet lain.`
    : '';
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT + scopeNote },
    ...history
  ];

  const prompt = COMMANDS[trimmed] ?? trimmed;
  const content: ChatMessage['content'] = imageBase64
    ? [
        { type: 'text', text: prompt || 'Analisis foto ini. Kalau ini struk/bukti, nilai keasliannya (watermark, tanggal, kecocokan).' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ]
    : prompt;

  messages.push({ role: 'user', content });
  // Vision input needs a vision-capable model (minimax-m3 via Ollama Cloud).
  const chatFn: ChatFn = imageBase64
    ? (m, t) => chat(m, t, CONFIG.visionModel)
    : chat;
  const reply = await agentLoop(messages, chatFn, scope);

  setMemory(chatId, [
    ...history,
    { role: 'user', content: trimmed },
    { role: 'assistant', content: reply }
  ]);
  void logChat(chatId, trimmed, reply);
  return reply;
}

async function logChat(chatId: number, question: string, answer: string): Promise<void> {
  try {
    await mkdir(CONFIG.dataDir, { recursive: true });
    await appendFile(
      join(CONFIG.dataDir, 'chat-log.jsonl'),
      JSON.stringify({ ts: nowWib(), chatId, question, answer }) + '\n'
    );
  } catch {
    /* logging must never break the chat */
  }
}
