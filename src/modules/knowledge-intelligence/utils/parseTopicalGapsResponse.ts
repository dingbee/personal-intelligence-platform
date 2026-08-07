/** Extracts a JSON array from a model response, tolerating markdown code fences — same convention as parseKnowledgeExtractionResponse's own extractJsonArray. */
function extractJsonArray(text: string): unknown[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()

  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('The model response did not contain a JSON array.')
  }

  const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1))
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array.')
  }
  return parsed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export interface TopicalKnowledgeGap {
  label: string
  reason: string
}

/**
 * Knowledge Intelligence Layer v1, Feature 6 — the model's own suggestion
 * of a plausible missing knowledge area, never presented as a certainty
 * (see the prompt in module.ts). Items missing a label are dropped rather
 * than rendered with an empty heading.
 */
export function parseTopicalGapsResponse(text: string): TopicalKnowledgeGap[] {
  return extractJsonArray(text)
    .filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.label === 'string' && item.label.trim().length > 0)
    .map((item) => ({
      label: (item.label as string).trim(),
      reason: typeof item.reason === 'string' ? item.reason.trim() : '',
    }))
}
