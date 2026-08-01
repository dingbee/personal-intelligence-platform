import type { Note } from '@/shared/types/database'
import type { KnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import { buildBriefingVariables } from '@/modules/knowledge-intelligence/api/briefingVariables'
import { recordKnowledgeNodeSource } from '@/modules/knowledge-intelligence/api/knowledgeNodeResolution'
import { listCollectionsContainingItem } from '@/modules/knowledge-intelligence/api/knowledgeCollections'
import { createNote } from '@/modules/notes/api/notes'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { indexNote } from '@/modules/search/indexing/indexNote'
import { linkKnownConceptsToSource } from '@/modules/knowledge-intelligence/api/linkKnownConcepts'
import { withArtifactKind } from '@/modules/ai/artifacts/artifactMetadata'

/**
 * Knowledge Actions v1 — Generate Briefing. Reuses the same capability
 * execution path as every other LLM call (runCapability + runWithFallback),
 * grounded only in a node's already-fetched evidence plus which
 * Collections it belongs to (buildBriefingVariables — no separate
 * retrieval, no full source content). The output isn't just displayed:
 * it's persisted as a real Note, linked back to the node via
 * recordKnowledgeNodeSource so the briefing itself becomes new evidence,
 * closing the loop that makes this an "action" rather than a one-off view.
 *
 * Platform Integration Sprint: search indexing and concept-mention linking
 * moved in here from the caller (previously only the concept drill-down
 * page's hook did this in its onSuccess) — this function now has two
 * callers (that hook, and the "Create an executive briefing on X" chat
 * command's orchestration, which isn't a React hook and has no onSuccess
 * to put it in), so leaving it as "the caller's responsibility" silently
 * meant briefings created via chat were unsearchable and never scanned for
 * further concept mentions. One pipeline should mean one behavior
 * regardless of entry point.
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
    generationMetadata: withArtifactKind(null, 'briefing'),
  })

  await recordKnowledgeNodeSource({
    userId,
    nodeId: evidence.node.id,
    sourceType: 'note',
    sourceId: note.id,
    sourceChunkIds: [],
  })

  void indexNote(note, workspaceId)
  void linkKnownConceptsToSource({
    userId: note.user_id,
    sourceType: 'note',
    sourceId: note.id,
    text: `${note.title}\n\n${note.content}`,
  })

  return note
}
