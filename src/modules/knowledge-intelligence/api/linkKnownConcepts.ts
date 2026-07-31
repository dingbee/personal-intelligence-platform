import { listKnowledgeNodeTitlesForUser } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { recordKnowledgeNodeSource } from '@/modules/knowledge-intelligence/api/knowledgeNodeResolution'
import { matchKnownConcepts } from '@/modules/knowledge-intelligence/utils/matchKnownConcepts'

/**
 * UX-13.11 Phase 2B — the deterministic half of "Concept Detection": no
 * LLM call, no new nodes ever created here. Scans new note/message text
 * for mentions of concepts the (manual, LLM-driven) extraction pipeline
 * has already discovered, and records evidence for each hit via the same
 * knowledge_node_sources ledger extraction uses — this is what makes a
 * node's "appears in N notes/N conversations" count real instead of
 * permanently zero for anything that isn't a document.
 *
 * Fire-and-forget contract, same as indexNote/indexMessage: called from
 * orchestration-level hooks, never blocks the caller, swallows its own
 * errors so a failed match just means this one save doesn't contribute
 * evidence — it never breaks note/message saving.
 */
export async function linkKnownConceptsToSource(params: {
  userId: string
  sourceType: 'note' | 'conversation'
  sourceId: string
  text: string
}): Promise<void> {
  if (!params.text.trim()) return

  try {
    const knownNodes = await listKnowledgeNodeTitlesForUser(params.userId)
    if (knownNodes.length === 0) return

    const matches = matchKnownConcepts(params.text, knownNodes)
    if (matches.length === 0) return

    await Promise.all(
      matches.map((match) =>
        recordKnowledgeNodeSource({
          userId: params.userId,
          nodeId: match.nodeId,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          sourceChunkIds: [],
        }),
      ),
    )
  } catch (err) {
    console.error(`Failed to link known concepts for ${params.sourceType} ${params.sourceId}:`, err)
  }
}
