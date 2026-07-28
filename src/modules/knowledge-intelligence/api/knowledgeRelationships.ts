import type { KnowledgeNode } from '@/shared/types/database'
import type { ExtractedRelationship } from '@/modules/knowledge-intelligence/utils/parseKnowledgeExtractionResponse'
import type { UpsertKnowledgeEdgeInput } from '@/modules/knowledge-intelligence/api/knowledgeEdges'

/**
 * Matches an LLM's {source, target} title strings back to real node ids
 * and builds edge-insert inputs — shared by same-document detection
 * (runKnowledgeExtraction) and cross-document reconciliation
 * (reconcileKnowledgeGraph, Phase 9B) so the matching/dedup/self-loop
 * rules live in exactly one place rather than twice. Pure — no I/O;
 * callers persist the result themselves via upsertKnowledgeEdges.
 *
 * A relationship whose source/target title doesn't exactly match a node
 * in `nodes` (LLM drift, punctuation, etc.) is silently dropped, same as
 * before this was extracted — not a behavior change, just relocated.
 */
export function buildEdgeInputsFromRelationships(
  nodes: KnowledgeNode[],
  relationships: ExtractedRelationship[],
  params: { userId: string; workspaceId: string | null; generatedBy: string },
): UpsertKnowledgeEdgeInput[] {
  const nodesByTitle = new Map(nodes.map((node) => [node.title, node]))

  return relationships.flatMap((item) => {
    const source = nodesByTitle.get(item.source)
    const target = nodesByTitle.get(item.target)
    if (!source || !target || source.id === target.id) return []
    return [
      {
        userId: params.userId,
        workspaceId: params.workspaceId,
        sourceType: 'knowledge_node',
        sourceId: source.id,
        targetType: 'knowledge_node',
        targetId: target.id,
        relationshipType: item.relationshipType,
        confidence: item.confidence,
        generatedBy: params.generatedBy,
      },
    ]
  })
}
