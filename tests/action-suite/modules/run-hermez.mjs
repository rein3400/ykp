import { APPS } from '../lib/config.mjs';
import { ActionRunner } from '../lib/runner.mjs';
import actions from '../actions/hermez.actions.json' with { type: 'json' };

const flags = {
  headed: process.argv.includes('--headed'),
  includeDestructive: process.argv.includes('--include-destructive'),
  noRetry: process.argv.includes('--no-retry'),
  only: process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]?.split(','),
  from: process.argv.find((a) => a.startsWith('--from='))?.split('=')[1],
};

const runner = new ActionRunner(APPS.hermez, actions, {
  outDir: 'tests/action-suite',
  flags,
});

await runner.run();
process.exit(runner.exitCode());
