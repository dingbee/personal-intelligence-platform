/**
 * Canonical-identity lookup key for a knowledge node's title (Phase 9A) —
 * exact-normalized matching only, no fuzzy matching. Must stay in lockstep
 * with the equivalent SQL expression in migration 0016's backfill; order
 * matters: punctuation is replaced with a space (never merges adjacent
 * words, e.g. "A,B" -> "a b" not "ab"), then whitespace collapses, then
 * lowercase.
 */
export function normalizeTitle(title: string): string {
  return title
    .trim()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}
