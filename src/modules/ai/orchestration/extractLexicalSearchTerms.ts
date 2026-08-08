/**
 * PIP Sprint 4/10 (Document Intelligence) — root cause of the ARRIYIA
 * failure: `match_document_chunks` is pure vector cosine similarity,
 * capped at a handful of results. A rare/invented proper noun mentioned
 * once in a long document can easily fail to land in the embedding
 * model's top matches for a full-sentence question, even though the term
 * appears verbatim in the text. Semantic search alone should not be the
 * only path to a chunk that literally contains the word being asked
 * about — this extracts candidate entity-like terms from a query so
 * retrieveContext can also search for them literally (see
 * lexicalChunkSearch.ts), the same "deterministic reinforcement, not a
 * replacement" philosophy hybridScore.ts already established for
 * Universal Search.
 *
 * Deliberately conservative: false negatives (missing a real entity) just
 * mean no lexical boost for that query — semantic search still runs
 * unchanged. False positives (extracting a non-entity word) just add one
 * extra, usually-empty lexical lookup — never excludes anything. Pure and
 * synchronous so it's trivially unit-testable without any LLM or network
 * call.
 */

const MIN_TERM_LENGTH = 3

// Common capitalized sentence-starters that would otherwise look like a
// Title-Case entity purely by virtue of position — excluded so "What does
// this document say about X" doesn't also search literally for "What".
const LEADING_STOPWORDS = new Set([
  'what',
  'where',
  'who',
  'which',
  'when',
  'why',
  'how',
  'is',
  'are',
  'was',
  'were',
  'does',
  'do',
  'did',
  'has',
  'have',
  'the',
  'a',
  'an',
  'this',
  'that',
  'in',
  'on',
  'about',
  'tell',
  'me',
  'please',
  'can',
  'you',
])

function unquote(text: string): string[] {
  const matches = text.match(/"([^"]+)"|'([^']+)'/g) ?? []
  return matches.map((m) => m.slice(1, -1).trim()).filter((m) => m.length >= MIN_TERM_LENGTH)
}

export function extractLexicalSearchTerms(query: string): string[] {
  const terms = new Set<string>()

  for (const quoted of unquote(query)) terms.add(quoted)

  const words = query.match(/[A-Za-z][A-Za-z0-9'-]*/g) ?? []
  words.forEach((word, index) => {
    if (word.length < MIN_TERM_LENGTH) return
    const isAllCaps = word === word.toUpperCase() && /[A-Z]/.test(word)
    if (isAllCaps) {
      terms.add(word)
      return
    }
    const isTitleCase = /^[A-Z][a-z]/.test(word)
    if (isTitleCase && index !== 0 && !LEADING_STOPWORDS.has(word.toLowerCase())) {
      terms.add(word)
    }
  })

  return [...terms]
}
