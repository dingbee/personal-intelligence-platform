/**
 * UX-13.5A — the rule engine both the AI-generated candidate and the
 * deterministic fallback are run through before either becomes a real
 * title. Pure and shared: whichever path produced the raw string,
 * "3-6 words, no punctuation, no emojis, not a generic placeholder" is
 * enforced exactly once, here.
 */
const MAX_WORDS = 6

/** Titles that fail to communicate anything about the conversation's actual content — rejected regardless of source. */
const GENERIC_TITLES = new Set(['new conversation', 'help', 'question', 'untitled', 'chat', 'conversation', 'new chat'])

// Covers the common emoji blocks (emoticons, symbols/pictographs,
// transport, supplemental symbols, dingbats) without pulling in a full
// Unicode-property-escape dependency.
const EMOJI_PATTERN =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu

function toTitleCase(word: string): string {
  if (word.length <= 3 && word === word.toUpperCase()) return word // preserve acronyms like "AI", "PIP"
  return word[0]!.toUpperCase() + word.slice(1).toLowerCase()
}

/**
 * Cleans and validates a raw candidate title (from either the AI capability
 * or the deterministic fallback). Returns null when the candidate can't be
 * turned into a real title — the caller then falls back further rather
 * than ever surfacing an empty or placeholder title.
 */
export function normalizeGeneratedTitle(raw: string): string | null {
  const withoutEmoji = raw.replace(EMOJI_PATTERN, ' ')
  const withoutQuotes = withoutEmoji.replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
  const withoutPunctuation = withoutQuotes.replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
  const words = withoutPunctuation
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)

  if (words.length === 0) return null

  const truncated = words.slice(0, MAX_WORDS)
  const title = truncated.map(toTitleCase).join(' ')

  if (GENERIC_TITLES.has(title.toLowerCase())) return null
  if (title.toLowerCase().startsWith('conversation about')) return null

  return title
}
