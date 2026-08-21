import { chat } from './dist/llm.js';
import { executeTool } from './dist/brain.js';

async function main() {
  // 1. LLM direct
  const r = await chat([{ role: 'user', content: 'Jawab singkat: 1+1 berapa?' }]);
  console.log('LLM OK:', r.content.slice(0, 120));

  // 2. Tool: finance summary (needs x-bot-secret)
  const fin = await executeTool('get_overview', { date: '2026-08-20' }, {});
  console.log('TOOL get_overview OK:', JSON.stringify(fin).slice(0, 200));

  // 3. Tool: sales items
  const sales = await executeTool('get_sales_items', { from: '2026-08-13', to: '2026-08-20' }, {});
  console.log('TOOL get_sales_items OK:', JSON.stringify(sales).slice(0, 200));
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
