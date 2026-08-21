import { handleText } from './dist/brain.js';

async function main() {
  // 1. Simple text (no tool needed)
  const r1 = await handleText(5721500978, 'halo, siapa kamu?');
  console.log('HANDLE simple OK:', r1.slice(0, 150));

  // 2. Question that should trigger a tool call (get_overview)
  const r2 = await handleText(5721500978, 'gimana kondisi bisnis hari ini?');
  console.log('HANDLE tool OK:', r2.slice(0, 300));
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
