import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import { normalizeTitle } from '@/modules/knowledge-intelligence/utils/normalizeTitle'

const DUPLICATE_TITLE_JACCARD_THRESHOLD = 0.6

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  const intersection = [...a].filter((word) => b.has(word)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : intersection / union
}

function hasDirectEdge(nodeAId: string, nodeBId: string, edges: KnowledgeLink[]): boolean {
  return edges.some(
    (edge) =>
      Boolean(edge.generated_by) &&
      ((edge.source_id === nodeAId && edge.target_id === nodeBId) ||
        (edge.source_id === nodeBId && edge.target_id === nodeAId)),
  )
}

/**
 * UX-13 — extracted from graphSignals.ts's inline duplicate_concept check
 * (UX-10 Phase 6), which only needed the *first* match to raise a signal.
 * knowledgeHealth needs every match to score how much duplication exists,
 * so the underlying near-duplicate detection (same node type, no existing
 * direct edge, normalized-title word overlap >= threshold but not
 * identical — exact-normalized duplicates are already merged into one
 * canonical node by resolveCanonicalNode, Phase 9A) now lives here as a
 * single source of truth; graphSignals.ts calls this too rather than
 * keeping its own copy.
 */
export function findDuplicateConceptPairs(nodes: KnowledgeNode[], edges: KnowledgeLink[]): [KnowledgeNode, KnowledgeNode][] {
  const pairs: [KnowledgeNode, KnowledgeNode][] = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!
      const b = nodes[j]!
      if (a.node_type !== b.node_type) continue
      if (hasDirectEdge(a.id, b.id, edges)) continue
      const similarity = jaccard(new Set(normalizeTitle(a.title).split(' ')), new Set(normalizeTitle(b.title).split(' ')))
      if (similarity >= DUPLICATE_TITLE_JACCARD_THRESHOLD && similarity < 1) {
        pairs.push([a, b])
      }
    }
  }
  return pairs
}
