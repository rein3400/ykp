/**
 * AI helpers for incident / complaint triage, sentiment, and response drafting.
 */
import { generateJson, generateText } from './ai';

export interface IncidentAiInput {
  incident_id: string;
  incident_type: string;
  severity: string;
  title: string;
  description: string;
  customer_name?: string;
  channel?: string;
  outlet_name?: string;
}

export interface IncidentAiResult {
  triage: {
    suggested_severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reasoning: string;
    category: string;
  };
  sentiment: {
    customer_sentiment: 'negative' | 'neutral' | 'positive';
    urgency: 'low' | 'medium' | 'high';
    reasoning: string;
  };
  response_draft: string;
}

const TRIAGE_SYSTEM = `You are an operational triage assistant for a multi-outlet F&B business (YKP Hermez). Analyze the incident and return JSON only in this exact shape:
{
  "triage": { "suggested_severity": "LOW|MEDIUM|HIGH|CRITICAL", "reasoning": "...", "category": "short label" },
  "sentiment": { "customer_sentiment": "negative|neutral|positive", "urgency": "low|medium|high", "reasoning": "..." },
  "response_draft": "professional Bahasa Indonesia response to the customer/staff"
}
Rules:
- Suggested severity must be one of LOW, MEDIUM, HIGH, CRITICAL.
- If incident_type is COMPLAINT, response_draft should be an apology + resolution steps + follow-up commitment.
- If incident_type is SAFETY or EQUIPMENT, response_draft should be internal action steps.
- Keep response_draft concise (max 3 short paragraphs), warm but professional.
- Never return markdown code fences; return raw JSON only.`;

export async function analyzeIncident(incident: IncidentAiInput): Promise<IncidentAiResult> {
  const prompt = `Analyze the following incident/complaint:

Incident ID: ${incident.incident_id}
Outlet: ${incident.outlet_name ?? '-'}
Type: ${incident.incident_type}
Current severity: ${incident.severity}
Title: ${incident.title}
Description: ${incident.description}
Customer: ${incident.customer_name ?? '-'}
Channel: ${incident.channel ?? '-'}

Return the JSON as instructed.`;

  return generateJson<IncidentAiResult>(prompt, {
    system: TRIAGE_SYSTEM,
    temperature: 0.3,
    maxTokens: 900,
  });
}

/**
 * Generate a concise customer/staff response draft only.
 */
export async function draftIncidentResponse(incident: IncidentAiInput): Promise<string> {
  const prompt = `Write a professional Bahasa Indonesia response for the following ${incident.incident_type} incident.

Title: ${incident.title}
Description: ${incident.description}
Customer: ${incident.customer_name ?? '-'}
Channel: ${incident.channel ?? '-'}
Outlet: ${incident.outlet_name ?? '-'}

Keep it to 2-3 short paragraphs, warm, apologetic if complaint, and include clear next steps.`;

  return generateText(prompt, { temperature: 0.4, maxTokens: 600 });
}
