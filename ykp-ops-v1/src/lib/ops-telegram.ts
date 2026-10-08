const INCIDENT_TYPES = ['OPERATIONAL', 'COMPLAINT', 'SAFETY', 'EQUIPMENT', 'OTHER'] as const;
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export interface IncidentCommand {
  title: string;
  incident_type: (typeof INCIDENT_TYPES)[number];
  severity: (typeof SEVERITIES)[number];
}

/** Join an app base URL with a path without doubling slashes. */
export function opsDeepLink(baseUrl: string, path: string): string {
  return `${(baseUrl ?? '').replace(/\/+$/, '')}/${(path ?? '').replace(/^\/+/, '')}`;
}

/**
 * Menu shown by the Telegram Ops bot. Every operational capability the outlet
 * staff need is listed; live-report flows are noted, and each feature has a
 * web deep-link so staff can always complete the action.
 */
export function opsMenuText(baseUrl: string): string {
  const link = (path: string) => opsDeepLink(baseUrl, path);
  return [
    '<b>🏪 Menu Operasional</b>',
    'Laporkan langsung dari sini: <b>/insiden</b> TEKS (mis. <code>/insiden AC bocor</code>).',
    'Lihat briefing hari ini: <b>/briefing</b>.',
    '',
    'Semua menu operasional (buka di web):',
    `• Opening — ${link('/ops/opening')}`,
    `• Closing — ${link('/ops/closing')}`,
    `• Briefing — ${link('/ops/briefing')} (bot: /briefing)`,
    `• KDS — ${link('/ops/kds')}`,
    `• QC — ${link('/ops/qc')}`,
    `• Insiden — ${link('/ops/incidents')} (bot: /insiden TEKS)`,
    `• Waste — ${link('/ops/waste')}`,
    `• Stock Issue — ${link('/ops/waste')}`,
    '',
    'Ketik /help untuk bantuan.'
  ].join('\n');
}

export type OpsUpdateRoute =
  | { kind: 'menu' }
  | { kind: 'briefing' }
  | { kind: 'incident'; text: string }
  | { kind: 'link'; code: string }
  | { kind: 'unknown' };

/** Classify a text message from the Ops bot. Pure + case-insensitive. */
export function routeOpsUpdate(text: string | undefined): OpsUpdateRoute {
  const t = (text ?? '').trim();
  if (/^\/(start|menu|help)\b/i.test(t) || t === '') return { kind: 'menu' };
  if (/^\/briefing\b/i.test(t)) return { kind: 'briefing' };
  const link = t.match(/^\/link\s+([A-Z2-9]{6})$/i);
  if (link) return { kind: 'link', code: link[1].toUpperCase() };
  const incident = t.match(/^\/insiden(?:\s+([\s\S]+))?$/i);
  if (incident) return { kind: 'incident', text: (incident[1] ?? '').trim() };
  return { kind: 'unknown' };
}

/** Parse + validate an incident report coming from the bot. Throws on invalid input. */
export function validateIncidentCommand(input: { title?: string; incident_type?: string; severity?: string }): IncidentCommand {
  const title = (input.title ?? '').trim();
  if (!title) throw new Error('Judul insiden wajib diisi');
  const type = (input.incident_type ?? 'OPERATIONAL').toUpperCase();
  const severity = (input.severity ?? 'MEDIUM').toUpperCase();
  if (!INCIDENT_TYPES.includes(type as (typeof INCIDENT_TYPES)[number])) throw new Error('Jenis insiden tidak valid');
  if (!SEVERITIES.includes(severity as (typeof SEVERITIES)[number])) throw new Error('Severity tidak valid');
  return { title, incident_type: type as IncidentCommand['incident_type'], severity: severity as IncidentCommand['severity'] };
}
