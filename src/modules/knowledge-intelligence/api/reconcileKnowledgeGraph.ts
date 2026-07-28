import type { KnowledgeNode } from '@/shared/types/database'
import { listKnowledgeNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { upsertKnowledgeEdges } from '@/modules/knowledge-intelligence/api/knowledgeEdges'
import { buildEdgeInputsFromRelationships } from '@/modules/knowledge-intelligence/api/knowledgeRelationships'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { parseRelationshipsResponse } from '@/modules/knowledge-intelligence/utils/parseKnowledgeExtractionResponse'

/** Bounds the prompt to a manageable, recent slice of the graph rather than every node a user has ever extracted — see the Phase 9B audit for why an unbounded cross-document scan doesn't fit in one prompt. */
const MAX_NODES = 60

export interface ReconcileKnowledgeGraphParams {
  userId: string
  workspaceId: string | null
  chain: string[]
}

export interface ReconcileKnowledgeGraphResult {
  nodesConsidered: number
  edgesCreated: number
}

/**
 * Phase 9B: same-document relationship detection (runKnowledgeExtraction)
 * only ever compares nodes extracted together from one document. This
 * reconciles across documents — it looks at the most recent nodes in a
 * user's graph regardless of source and asks the model to find
 * relationships between them, reusing the exact same matching/persistence
 * path (buildEdgeInputsFromRelationships + upsertKnowledgeEdges) as the
 * same-document path. Manually triggered only — not wired into the
 * per-document extraction flow.
 */
export async function reconcileKnowledgeGraph(params: ReconcileKnowledgeGraphParams): Promise<ReconcileKnowledgeGraphResult> {
  const { userId, workspaceId, chain } = params

  const nodes = await listKnowledgeNodes({ workspaceId, limit: MAX_NODES })
  if (nodes.length < 2) {
    return { nodesConsidered: nodes.length, edgesCreated: 0 }
  }

  const { result: relationshipsRun } = await runWithFallback(chain, (candidateId) =>
    runCapability({
      capabilityId: 'detect-cross-document-relationships',
      variables: { nodes: JSON.stringify(nodes.map(describeNode)) },
      userId,
      workspaceId,
      providerId: candidateId,
      requestedProviderId: chain[0],
    }),
  )

  const relationshipItems = parseRelationshipsResponse(relationshipsRun.content)
  const edges = buildEdgeInputsFromRelationships(nodes, relationshipItems, {
    userId,
    workspaceId,
    generatedBy: 'ai:detect-cross-document-relationships',
  })

  await upsertKnowledgeEdges(edges)

  return { nodesConsidered: nodes.length, edgesCreated: edges.length }
}

function describeNode(node: KnowledgeNode) {
  return { title: node.title, type: node.node_type, description: node.description }
}
