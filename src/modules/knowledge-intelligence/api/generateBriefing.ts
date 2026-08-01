import type { Note } from '@/shared/types/database'
import type { KnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import { buildBriefingVariables } from '@/modules/knowledge-intelligence/api/briefingVariables'
import { recordKnowledgeNodeSource } from '@/modules/knowledge-intelligence/api/knowledgeNodeResolution'
import { listCollectionsContainingItem } from '@/modules/knowledge-intelligence/api/knowledgeCollections'
import { createNote } from '@/modules/notes/api/notes'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'

/**
 * Knowledge Actions v1 — Generate Briefing. Reuses the same capability
 * execution path as every other LLM call (runCapability + runWithFallback),
 * grounded only in a node's already-fetched evidence plus which
 * Collections it belongs to (buildBriefingVariables — no separate
 * retrieval, no full source content). The output isn't just displayed:
 * it's persisted as a real Note, linked back to the node via
 * recordKnowledgeNodeSource so the briefing itself becomes new evidence,
 * closing the loop that makes this an "action" rather than a one-off view.
 * Search indexing is the caller's responsibility (hook layer), matching
 * every other note-creation call site's convention. This one function
 * backs both the concept drill-down page's "Generate briefing" button and
 * the UX-13 roadmap Phase 5 "Create an executive briefing on X" chat
 * command — one pipeline, not two.
 */
export async function generateBriefing(params: {
  evidence: KnowledgeNodeEvidence
  userId: string
  workspaceId: string | null
  chain: string[]
}): Promise<Note> {
  const { evidence, userId, workspaceId, chain } = params
  const collections = await listCollectionsContainingItem('knowledge_node', evidence.node.id)
  const variables = buildBriefingVariables(evidence, collections)

  const { result } = await runWithFallback(chain, (candidateId) =>
    runCapability({
      capabilityId: 'generate-briefing',
      variables,
      userId,
      workspaceId,
      providerId: candidateId,
      requestedProviderId: chain[0],
    }),
  )

  const note = await createNote({
    userId,
    workspaceId,
    title: `Briefing: ${evidence.node.title}`,
    content: result.content.trim(),
  })

  await recordKnowledgeNodeSource({
    userId,
    nodeId: evidence.node.id,
    sourceType: 'note',
    sourceId: note.id,
    sourceChunkIds: [],
  })

  return note
}
