/**
 * AI insight generator for operational daily summaries.
 */
import { generateText } from './ai';

export interface SummaryInsightInput {
  date: string;
  outlet_name: string;
  opening_status: string;
  opening_completion_percentage: string;
  critical_opening_issue: string;
  scheduled_staff: string;
  actual_staff: string;
  shift_shortage: string;
  total_orders: string;
  avg_serving_time: string;
  orders_over_sla: string;
  critical_delay_count: string;
  avg_qc_score: string;
  qc_fail_count: string;
  incident_count: string;
  high_severity_incident: string;
  complaint_count: string;
  waste_qty: string;
  waste_value: string;
  stock_issue_count: string;
  closing_status: string;
  cash_difference: string;
  open_action_count: string;
  major_ops_issue: string;
  recommended_action: string;
}

const SYSTEM = `You are an operational analytics assistant for a multi-outlet F&B business (YKP Hermez). Given a daily operational summary, write a concise Bahasa Indonesia insight for the outlet manager/owner.

Rules:
- Max 3 short paragraphs.
- Highlight the biggest risk or opportunity first.
- Compare to thresholds where relevant (cash diff tolerance Rp50.000, waste high if Rp200.000+, SLA target 180s, QC target 4.0/5, opening completion 95%).
- End with 1-2 concrete action items.
- Do not invent data not present in the summary.`;

export async function generateSummaryInsight(summary: Record<string, string>): Promise<string> {
  const prompt = `Generate insight for operational summary:

Date: ${summary.date}
Outlet: ${summary.outlet_name}
Opening: ${summary.opening_status} (${summary.opening_completion_percentage}% complete, ${summary.critical_opening_issue} critical issues)
Staff: ${summary.actual_staff}/${summary.scheduled_staff} scheduled, shortage ${summary.shift_shortage}
KDS: ${summary.total_orders} orders, avg serving ${summary.avg_serving_time}s, ${summary.orders_over_sla} over SLA, ${summary.critical_delay_count} critical delays
QC: avg ${summary.avg_qc_score}/5, ${summary.qc_fail_count} fails
Incidents: ${summary.incident_count} total, ${summary.high_severity_incident} high/critical, ${summary.complaint_count} complaints
Waste: ${summary.waste_qty} qty, Rp ${summary.waste_value}
Stock issues: ${summary.stock_issue_count}
Closing: ${summary.closing_status}, cash difference Rp ${summary.cash_difference}
Open actions: ${summary.open_action_count}
Major issue: ${summary.major_ops_issue}
Recommended action: ${summary.recommended_action}

Write the insight in Bahasa Indonesia.`;

  return generateText(prompt, { system: SYSTEM, temperature: 0.4, maxTokens: 700 });
}
