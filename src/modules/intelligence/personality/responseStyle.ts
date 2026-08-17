export type ResponseStyleHint = 'brief' | 'standard' | 'exploratory'

const EXPLORATORY_MARKERS = ['explain', 'explore', 'help me understand', 'walk me through', 'compare', 'why']
const BRIEF_WORD_LIMIT = 6

/**
 * Deterministic, not AI-graded — a short direct question ("what year?")
 * wants a short direct answer; an open-ended one ("explain how X relates
 * to Y") wants room to develop. Cheap enough to run on every message.
 */
export function inferResponseStyleHint(query: string): ResponseStyleHint {
  const trimmed = query.trim().toLowerCase()
  if (EXPLORATORY_MARKERS.some((marker) => trimmed.includes(marker))) return 'exploratory'

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  if (wordCount > 0 && wordCount <= BRIEF_WORD_LIMIT) return 'brief'

  return 'standard'
}
