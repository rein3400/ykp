import { describe, expect, it } from 'vitest';
import { sessionTabAction, OPS_COMMANDS } from './telegram-provision';
describe('Ops provisioning contract', () => {
 it('creates only missing/empty sessions and refuses incompatible headers', () => {
  expect(sessionTabAction(undefined)).toBe('create');
  expect(sessionTabAction([])).toBe('write_headers');
  expect(sessionTabAction(['chat_id','state_json','last_update_id','last_reply','updated_at','user_id'])).toBe('ready');
  expect(()=>sessionTabAction(['user_id','state_json'])).toThrow();
 });
 it('publishes all reporting commands without duplicate names', () => {
  expect(new Set(OPS_COMMANDS.map(c=>c.command)).size).toBe(OPS_COMMANDS.length);
  for(const command of ['opening','closing','checklist','incident','complaint','waste','stock','qc','kds','briefing','batal','link'])expect(OPS_COMMANDS.some(c=>c.command===command)).toBe(true);
 });
});
