/**
 * AI-written daily brief (22:05 WIB). Collects the same data the owner
 * would ask about, then lets the LLM write the analysis: anomalies first,
 * then recommendations. Replaces template-text briefs with judgment.
 */
import { CONFIG, todayWib, daysAgoWib } from './config.js';
import { chat } from './openrouter.js';
import { executeTool } from './brain.js';
import { sendToOwners } from './telegram.js';

const BRIEF_PROMPT = `Tulis DAILY BRIEF untuk owner YKP dalam Bahasa Indonesia.

Struktur wajib:
1. <b>Ringkasan hari ini</b> — revenue, surplus kas, kehadiran, kondisi outlet (2-4 kalimat)
2. <b>Yang perlu perhatian</b> — anomali/deviasi yang terlihat dari data (penjualan turun vs biasanya, selisih kas, margin aneh, stok kritis, telat banyak). Kalau tidak ada, bilang bersih.
3. <b>Rekomendasi</b> — 2-3 aksi konkret untuk besok.

Aturan: angka format Rp titik ribuan, sebut periode data, jujur kalau jelek, maksimal 350 kata, pakai emoji seperlunya. Data JSON menyusul.`;

export async function runDailyBrief(): Promise<string> {
  const today = todayWib();
  const weekAgo = daysAgoWib(7);
  const [overview, sales, margins, alerts, activity] = await Promise.all([
    executeTool('get_overview', { date: today }),
    executeTool('get_sales_items', { from: weekAgo, to: today }),
    executeTool('get_margins', { from: weekAgo, to: today }),
    executeTool('get_alerts', {}),
    executeTool('get_activity', { from: today, to: today })
  ]);
  const data = JSON.stringify({ tanggal: today, overview, sales_7d: sales, margins_7d: margins, alerts, aktivitas_hari_ini: activity });

  const result = await chat(
    [
      { role: 'system', content: BRIEF_PROMPT },
      { role: 'user', content: data }
    ],
    undefined,
    CONFIG.model
  );
  const text = `🌙 <b>HERMEZ DAILY BRIEF</b> — ${today}\n\n${result.content}`;
  await sendToOwners(text);
  return text;
}
