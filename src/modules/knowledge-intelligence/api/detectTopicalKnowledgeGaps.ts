import { listKnowledgeNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { parseTopicalGapsResponse, type TopicalKnowledgeGap } from '@/modules/knowledge-intelligence/utils/parseTopicalGapsResponse'

/** Bounds the prompt the same way reconcileKnowledgeGraph.ts's MAX_NODES does — a manageable, recent slice of concepts, not the whole graph. */
const MAX_CONCEPTS = 40

export interface DetectTopicalKnowledgeGapsParams {
  userId: string
  workspaceId: string | null
  chain: string[]
}

/**
 * Knowledge Intelligence Layer v1, Feature 6 — computeKnowledgeGaps (see
 * src/modules/evolution/knowledgeGaps) already answers "what's orphaned,
 * unread, or stale" from data the app already computes. It can't answer
 * "what topic are you conspicuously missing" (the task's own "strategy +
 * marketing but no financial model" example) — that needs a semantic read
 * of the concepts themselves, which only a model call can give. Kept
 * entirely separate from computeKnowledgeGaps rather than merged into it:
 * one is deterministic fact, this is a labeled model suggestion, and this
 * project's own discipline is to never blur those two.
 */
export async function detectTopicalKnowledgeGaps(params: DetectTopicalKnowledgeGapsParams): Promise<TopicalKnowledgeGap[]> {
  const { userId, workspaceId, chain } = params

  const nodes = await listKnowledgeNodes({ workspaceId, nodeType: 'concept', limit: MAX_CONCEPTS })
  if (nodes.length === 0) return []

  const { result } = await runWithFallback(chain, (candidateId) =>
    runCapability({
      capabilityId: 'detect-topical-knowledge-gaps',
      variables: { concepts: JSON.stringify(nodes.map((n) => n.title)) },
      userId,
      workspaceId,
      providerId: candidateId,
      requestedProviderId: chain[0],
    }),
  )

  return parseTopicalGapsResponse(result.content)
}
