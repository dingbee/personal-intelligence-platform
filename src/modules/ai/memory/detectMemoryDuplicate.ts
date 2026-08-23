import type { AiMemory } from '@/shared/types/database'

/**
 * UX-14.2 Memory Evolution (Reinforcement) — deterministic duplicate/near-
 * duplicate detection, conservative lexical normalization and token
 * overlap rather than an LLM or embedding call, matching the same
 * philosophy filterMemoriesByRelevance/extractLexicalSearchTerms already
 * established for this codebase's memory system: a false negative (two
 * genuinely-equivalent statements phrased differently enough to miss the
 * threshold) just creates one extra row, no worse than today's behavior;
 * a false positive (reinforcing the wrong memory) is the one outcome to
 * guard hard against, since it would silently merge two different facts.
 */
const DUPLICATE_OVERLAP_THRESHOLD = 0.82

/** Same trailing-punctuation-only stripping as detectMemoryCandidates' own `clean()` — deliberately not stripping all punctuation, which would risk collapsing distinct short statements together. */
export function normalizeMemoryContent(content: string): string {
  return content
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]+$/, '')
    .replace(/\s+/g, ' ')
}

function tokenize(content: string): Set<string> {
  const words = normalizeMemoryContent(content).match(/[a-z0-9']+/g) ?? []
  return new Set(words)
}

/** Jaccard similarity over normalized word sets. 0 when either side has no tokens at all — an empty/whitespace-only memory never counts as a match for anything, rather than dividing by zero into a false 100%. */
export function memoryContentOverlap(a: string, b: string): number {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let intersectionSize = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) intersectionSize += 1
  }
  const unionSize = tokensA.size + tokensB.size - intersectionSize
  return unionSize === 0 ? 0 : intersectionSize / unionSize
}

/** An exact normalized match always counts (whitespace/case/punctuation-only differences), otherwise the two statements need substantial token overlap — enough to catch "User prefers concise answers." vs "User prefers concise responses" without also catching "User prefers concise answers." vs "User prefers detailed answers." (a genuine contradiction, not a repeat — they share only 3 of 5 tokens, well under threshold). */
export function isNearDuplicateMemoryContent(a: string, b: string): boolean {
  if (normalizeMemoryContent(a) === normalizeMemoryContent(b)) return true
  return memoryContentOverlap(a, b) >= DUPLICATE_OVERLAP_THRESHOLD
}

/**
 * Finds the best-matching existing memory a new candidate's content should
 * reinforce instead of duplicating, or null if none of `existing` is a
 * confirmed repeat. Callers are responsible for scoping `existing` first —
 * same memory_type, same workspace, active only (see
 * rememberMemoryCandidate.ts) — this only ever compares content.
 */
export function findReinforcementTarget(candidateContent: string, existing: AiMemory[]): AiMemory | null {
  let best: AiMemory | null = null
  let bestScore = -1

  for (const memory of existing) {
    const score = normalizeMemoryContent(memory.content) === normalizeMemoryContent(candidateContent) ? 1 : memoryContentOverlap(memory.content, candidateContent)
    if (score >= DUPLICATE_OVERLAP_THRESHOLD && score > bestScore) {
      best = memory
      bestScore = score
    }
  }

  return best
}
