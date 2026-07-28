/** Extracts a JSON array from a model response, tolerating markdown code fences — same convention as parseFlashcardsResponse. */
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

export interface ExtractedConcept {
  title: string
  description: string | null
}

export function parseConceptsResponse(text: string): ExtractedConcept[] {
  return extractJsonArray(text)
    .filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.title === 'string')
    .map((item) => ({
      title: item.title as string,
      description: typeof item.description === 'string' ? item.description : null,
    }))
}

export interface ExtractedEntity {
  title: string
  description: string | null
  entityType: string | null
}

export function parseEntitiesResponse(text: string): ExtractedEntity[] {
  return extractJsonArray(text)
    .filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.title === 'string')
    .map((item) => ({
      title: item.title as string,
      description: typeof item.description === 'string' ? item.description : null,
      entityType: typeof item.entityType === 'string' ? item.entityType : null,
    }))
}

export interface ExtractedRelationship {
  source: string
  target: string
  relationshipType: string
  confidence: number | null
}

export function parseRelationshipsResponse(text: string): ExtractedRelationship[] {
  return extractJsonArray(text)
    .filter(
      (item): item is Record<string, unknown> =>
        isRecord(item) &&
        typeof item.source === 'string' &&
        typeof item.target === 'string' &&
        typeof item.relationshipType === 'string',
    )
    .map((item) => ({
      source: item.source as string,
      target: item.target as string,
      relationshipType: item.relationshipType as string,
      confidence: typeof item.confidence === 'number' ? item.confidence : null,
    }))
}
