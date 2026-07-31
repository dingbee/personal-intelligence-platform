import { normalizeTitle } from '@/modules/knowledge-intelligence/utils/normalizeTitle'

export interface KnownConceptTitle {
  id: string
  title: string
  titleNormalized: string
}

export interface MatchedConcept {
  nodeId: string
  title: string
}

/**
 * UX-13.11 Phase 2B — deterministic *matching* of already-known concepts
 * into new text, not LLM-based *discovery* of new ones. The LLM extraction
 * pipeline (runKnowledgeExtraction) is what decides a title is worth being
 * a node in the first place; this only asks "does this text mention a
 * title that's already a node?" via whole-word-sequence matching over the
 * same normalizeTitle() key the resolver dedups on — no new vocabulary is
 * ever introduced here, only new evidence for existing nodes.
 *
 * Single-word titles under 3 normalized characters are skipped (e.g. "ok",
 * "it") — multi-word titles are inherently safe since a false positive
 * needs every word to appear contiguously in order.
 */
export function matchKnownConcepts(text: string, nodes: KnownConceptTitle[]): MatchedConcept[] {
  const normalizedText = normalizeTitle(text)
  if (!normalizedText) return []
  const textWords = normalizedText.split(' ')

  const matches: MatchedConcept[] = []
  for (const node of nodes) {
    const titleWords = node.titleNormalized.split(' ').filter(Boolean)
    if (titleWords.length === 0) continue
    if (titleWords.length === 1 && titleWords[0]!.length < 3) continue
    if (containsWordSequence(textWords, titleWords)) {
      matches.push({ nodeId: node.id, title: node.title })
    }
  }
  return matches
}

function containsWordSequence(haystack: string[], needle: string[]): boolean {
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let matched = true
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        matched = false
        break
      }
    }
    if (matched) return true
  }
  return false
}
