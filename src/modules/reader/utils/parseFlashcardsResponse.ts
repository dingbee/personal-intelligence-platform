/** Extracts a JSON array of {front, back} from a model response, tolerating markdown code fences around it. */
export function parseFlashcardsResponse(text: string): { front: string; back: string }[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()

  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('The model response did not contain a JSON array of flashcards.')
  }

  const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1))
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array of flashcards.')
  }

  return parsed.filter(
    (item): item is { front: string; back: string } =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).front === 'string' &&
      typeof (item as Record<string, unknown>).back === 'string',
  )
}
