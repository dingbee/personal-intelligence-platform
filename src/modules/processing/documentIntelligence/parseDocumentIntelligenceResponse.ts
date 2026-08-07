/** Extracts a JSON object from a model response, tolerating markdown code fences — same convention as parseKnowledgeExtractionResponse's extractJsonArray, but for a single object instead of an array. */
function extractJsonObject(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('The model response did not contain a JSON object.')
  }

  const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Expected a JSON object.')
  }
  return parsed as Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export interface ParsedDocumentIntelligence {
  documentType: string
  dates: { label: string; date: string }[]
  decisions: string[]
  tasks: { description: string; owner: string | null }[]
}

/**
 * Multimodal Intelligence v1 — every field defaults to the honest empty
 * value ('other' / []) rather than throwing, so a response that's missing
 * a field (or has a malformed sub-array) still yields whatever it did
 * parse instead of discarding the whole analysis.
 */
export function parseDocumentIntelligenceResponse(text: string): ParsedDocumentIntelligence {
  const obj = extractJsonObject(text)

  const documentType = typeof obj.documentType === 'string' && obj.documentType.trim() ? obj.documentType.trim() : 'other'

  const dates = Array.isArray(obj.dates)
    ? obj.dates
        .filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.label === 'string' && typeof item.date === 'string')
        .map((item) => ({ label: item.label as string, date: item.date as string }))
    : []

  const decisions = Array.isArray(obj.decisions) ? obj.decisions.filter((item): item is string => typeof item === 'string') : []

  const tasks = Array.isArray(obj.tasks)
    ? obj.tasks
        .filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.description === 'string')
        .map((item) => ({
          description: item.description as string,
          owner: typeof item.owner === 'string' ? item.owner : null,
        }))
    : []

  return { documentType, dates, decisions, tasks }
}
