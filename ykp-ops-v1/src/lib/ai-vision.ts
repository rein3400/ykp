/**
 * AI vision second opinion for Visual QC.
 * Uses OpenAI gpt-4o-mini vision capabilities via base64 data URI or public URL.
 * Always returns a structured assessment; never overrides the human reviewer.
 */

export interface QcVisionInput {
  photoUrl: string; // base64 data URI or public URL
  productName: string;
  qcCategory: string;
  referenceStandard?: string;
  humanScore?: string;
  humanStatus?: string;
}

export interface QcVisionResult {
  ai_assessment: 'PASS' | 'NEEDS_REVIEW' | 'FAIL' | 'UNABLE_TO_ASSESS';
  ai_confidence: number; // 0-1
  defects_detected: string[];
  ai_notes: string;
  recommendation: string;
}

const SYSTEM = `You are a food quality control vision assistant. You are given a product photo and asked to give a SECOND OPINION for a manual QC score. You MUST NOT be the sole decision maker.

Analyze the image for the given QC category (APPEARANCE, COLOR, PORTION, TEMPERATURE, TEXTURE, PACKAGING, CLEANLINESS). Return ONLY JSON in this exact shape:
{
  "ai_assessment": "PASS|NEEDS_REVIEW|FAIL|UNABLE_TO_ASSESS",
  "ai_confidence": 0.0-1.0,
  "defects_detected": ["short defect label"],
  "ai_notes": "1-2 sentences in Bahasa Indonesia",
  "recommendation": "1 sentence action item"
}
Rules:
- If the image is unclear or not food-related, return UNABLE_TO_ASSESS with confidence 0.
- Be conservative: prefer NEEDS_REVIEW over FAIL unless defect is obvious.
- Confidence reflects image clarity and defect obviousness, not just PASS/FAIL.
- Return raw JSON only, no markdown code fences.`;

export async function analyzeQcPhoto(input: QcVisionInput): Promise<QcVisionResult> {
  const prompt = `QC Category: ${input.qcCategory}
Product: ${input.productName}
Human score: ${input.humanScore ?? '-'}
Human status: ${input.humanStatus ?? '-'}
Reference standard: ${input.referenceStandard ?? 'standard menu quality'}

Analyze the attached photo and return the JSON as instructed.`;

  type MessageContent =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'low' | 'high' | 'auto' } };

  const messages: { role: 'system' | 'user'; content: string | MessageContent[] }[] = [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: input.photoUrl, detail: 'low' } },
      ],
    },
  ];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const model = process.env.AI_MODEL ?? 'gpt-4o-mini';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    throw new Error(`OpenAI HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) throw new Error('OpenAI returned empty content');
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned) as QcVisionResult;
}

export function qcVisionHealth(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
