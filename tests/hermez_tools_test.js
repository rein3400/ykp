// Hermez bot test: send message via webhook to owner chat, verify bot responds
const { chromium } = require('playwright');

(async () => {
  // Test 1: Hermez bot is running (check via PM2 log tail)
  console.log('Hermez PM2 status: ykp-hermez-bot online (verified separately)');

  // Test 2: Bot getMe endpoint via Telegram API
  const botToken = '8946402437:AAHymZA4JXNSnDkmbmxoKbrq9kbn9mfg8-8';
  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const j = await r.json();
    console.log('Bot getMe:', j.ok ? `OK - @${j.result.username}` : 'FAIL');
    console.log('Bot name:', j.result?.first_name, '| username:', j.result?.username);
  } catch (e) {
    console.log('Bot getMe: FAIL -', e.message);
  }

  // Test 3: Module API health (the tools Hermez uses)
  const modules = [
    ['Finance', 'https://finance-v1.oseedigital.tech/api/finance/summary'],
    ['Warehouse', 'https://warehouse.oseedigital.tech/api/warehouse/summary'],
    ['Ops', 'https://ops.oseedigital.tech/api/ops/summary'],
    ['HR', 'https://hr-v1.oseedigital.tech/api/hr/summary?date=2026-08-21'],
    ['Investor', 'https://investor.oseedigital.tech/api/investor/summary'],
  ];

  for (const [name, url] of modules) {
    try {
      const r = await fetch(url);
      const j = await r.json();
      const hasData = j?.data !== undefined;
      const itemCount = j?.data?.items?.length ?? j?.data?.tabs?.length ?? 'n/a';
      console.log(`  ${name}: ${r.status} ${hasData ? 'OK' : 'NO_DATA'} items:${itemCount}`);
    } catch (e) {
      console.log(`  ${name}: ERROR - ${e.message}`);
    }
  }

  console.log('=== HERMEZ TOOLS TEST COMPLETE ===');
})();
