import type { Note } from '@/shared/types/database'
import { searchKnowledgeConcepts } from '@/modules/knowledge-intelligence/api/searchKnowledgeConcepts'
import { getKnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import { generateBriefing } from '@/modules/knowledge-intelligence/api/generateBriefing'

export interface ExecutiveBriefingCommandResult {
  found: true
  nodeId: string
  nodeTitle: string
  note: Note
  responseText: string
}

export interface ExecutiveBriefingCommandNotFound {
  found: false
  topic: string
  responseText: string
}

/**
 * UX-13 roadmap Phase 5 — the orchestration behind "Create an executive
 * briefing on X": Search (searchKnowledgeConcepts) resolves the topic to a
 * concept, then Generate Briefing does the rest (Confidence + Knowledge
 * Graph via getKnowledgeNodeEvidence, Collections via
 * listCollectionsContainingItem, Save Note) — the exact same pipeline the
 * concept drill-down page's "Generate briefing" button already uses, not
 * a parallel implementation. This function's only new work is resolving
 * free text to a node and formatting the chat response.
 */
export async function runExecutiveBriefingCommand(params: {
  topic: string
  userId: string
  workspaceId: string | null
  chain: string[]
}): Promise<ExecutiveBriefingCommandResult | ExecutiveBriefingCommandNotFound> {
  const { topic, userId, workspaceId, chain } = params

  const matches = await searchKnowledgeConcepts(topic, userId, 1)
  if (matches.length === 0) {
    return {
      found: false,
      topic,
      responseText: `I couldn't find a concept called "${topic}" in your knowledge graph yet. Once it's been extracted from a document, note, or conversation, I can generate a briefing on it.`,
    }
  }

  const node = matches[0]!
  const evidence = await getKnowledgeNodeEvidence(node.id)
  const note = await generateBriefing({ evidence, userId, workspaceId, chain })

  const confidencePercent = Math.round(evidence.confidence * 100)
  const responseText =
    `Here's the executive briefing on "${node.title}" (${confidencePercent}% knowledge confidence):\n\n` +
    `${note.content}\n\n` +
    `Saved as a note and linked back to the concept as new evidence.`

  return { found: true, nodeId: node.id, nodeTitle: node.title, note, responseText }
}
