/** Deterministic option-splitting patterns — "A vs B", "A versus B", "A or B". Ordered most-to-least specific so "vs" wins over a bare "or" when both could match. */
export const OPTION_SPLIT_PATTERNS: RegExp[] = [
  /^(.+?)\s+vs\.?\s+(.+)$/i,
  /^(.+?)\s+versus\s+(.+)$/i,
  /^(.+?)\s+or\s+(.+?)\??$/i,
]

const LEADING_PHRASES = /^(should i|is it worth (going with|choosing|picking)|which (one|option) should i choose:?)\s*/i

/** Strips a leading decision-question phrase ("Should I...") before splitting, so the extracted options are just the two things being weighed, not the whole sentence. */
export function stripLeadingDecisionPhrase(text: string): string {
  return text.trim().replace(LEADING_PHRASES, '').trim()
}
