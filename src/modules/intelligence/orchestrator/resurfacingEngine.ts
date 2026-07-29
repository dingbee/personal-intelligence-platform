import type { ResurfacedKnowledgeItem } from '@/modules/intelligence/orchestrator/types'

export interface ResurfacingEngineInput {
  inProgressDocument: { id: string; title: string; scrollFraction: number } | null
  recentNotes: { id: string; title: string }[]
  recentConversations: { id: string; title: string }[]
}

/**
 * UX-8 Phase 4 — resurfaces existing metadata only (no vector search, no
 * new query beyond what orchestrator.ts already fetches for other
 * purposes: reading progress, listNotes, listConversations). Deliberately
 * narrower than the brief's full example list — "previously summarized
 * books" and "recent highlights" would need a workspace-wide chapter-
 * summaries/highlights query that doesn't exist yet, and "frequently
 * referenced concepts" would need per-node reference-count aggregation
 * beyond what knowledge_node_sources currently exposes in one query; both
 * deferred rather than added as new queries not otherwise justified.
 */
export function resurfaceKnowledge(input: ResurfacingEngineInput): ResurfacedKnowledgeItem[] {
  const items: ResurfacedKnowledgeItem[] = []

  if (input.inProgressDocument && input.inProgressDocument.scrollFraction > 0) {
    items.push({
      type: 'document',
      id: input.inProgressDocument.id,
      title: input.inProgressDocument.title,
      href: `/library/${input.inProgressDocument.id}/read`,
    })
  }

  for (const note of input.recentNotes) {
    items.push({ type: 'note', id: note.id, title: note.title, href: `/notes/${note.id}` })
  }

  for (const conversation of input.recentConversations) {
    items.push({
      type: 'conversation',
      id: conversation.id,
      title: conversation.title,
      href: `/chat?conversationId=${conversation.id}`,
    })
  }

  return items
}
