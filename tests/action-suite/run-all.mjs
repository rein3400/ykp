import { spawn } from 'node:child_process';
import path from 'node:path';
import { APPS } from './lib/config.mjs';
import { loadReport, writeSummary } from './lib/report.mjs';

const moduleOrder = ['hub', 'investor', 'hermez', 'hrPilot', 'finance', 'hrProd', 'warehouse'];

function parseArgs() {
  const args = process.argv.slice(2);
  const onlyModules = args.find((a) => a.startsWith('--module='))?.split('=')[1]?.split(',');
  const parallel = parseInt(args.find((a) => a.startsWith('--parallel='))?.split('=')[1] || '1', 10);
  const headed = args.includes('--headed');
  const includeDestructive = args.includes('--include-destructive');
  return { onlyModules, parallel, headed, includeDestructive };
}

function runModule(moduleId, flags) {
  return new Promise((resolve) => {
    const script = path.join('tests', 'action-suite', 'modules', `run-${moduleId}.mjs`);
    const args = [script];
    if (flags.headed) args.push('--headed');
    if (flags.includeDestructive) args.push('--include-destructive');
    const child = spawn(process.execPath, args, { stdio: 'inherit', cwd: process.cwd() });
    child.on('close', (code) => resolve({ moduleId, code }));
  });
}

async function main() {
  const { onlyModules, parallel, headed, includeDestructive } = parseArgs();
  const modules = onlyModules ? moduleOrder.filter((m) => onlyModules.includes(m)) : moduleOrder;
  const results = [];

  console.log(`Running modules: ${modules.join(', ')} (parallel=${parallel})`);

  if (parallel <= 1) {
    for (const m of modules) {
      const r = await runModule(m, { headed, includeDestructive });
      results.push(r);
    }
  } else {
    const chunks = [];
    for (let i = 0; i < modules.length; i += parallel) {
      chunks.push(modules.slice(i, i + parallel));
    }
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(chunk.map((m) => runModule(m, { headed, includeDestructive })));
      results.push(...chunkResults);
    }
  }

  const reports = modules.map((m) => loadReport('tests/action-suite', m));
  writeSummary('tests/action-suite', reports);

  const failed = results.filter((r) => r.code !== 0);
  console.log(`\nDone. ${results.length - failed.length}/${results.length} modules OK.`);
  if (failed.length) {
    console.log(`Failed modules: ${failed.map((f) => f.moduleId).join(', ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
