import { supabase } from '@/shared/lib/supabase'
import type { SearchProvider, SearchQuery, SearchResult } from '@/modules/search/types'
import { computeConversationScore } from '@/modules/search/ranking/conversationScore'

/**
 * UX-13.11 Phase 2A — the conversation is the knowledge object, not the
 * individual message: match_messages can return several hits from the same
 * conversation, and previously each became its own search result. This now
 * groups by conversation_id and returns one result per conversation, using
 * the strongest-matching message as the snippet/deep-link target and
 * folding the rest into the match count and score.
 */
export const conversationSearchProvider: SearchProvider = {
  id: 'conversation',

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const { data, error } = await supabase.rpc('match_messages', {
      query_embedding: query.queryEmbedding,
      match_count: query.matchCount,
      filter_workspace_id: query.workspaceId,
    })
    if (error) throw error
    if (data.length === 0) return []

    const conversationIds = Array.from(new Set(data.map((row) => row.conversation_id)))
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('id, title, workspace_id, updated_at')
      .in('id', conversationIds)
    if (conversationsError) throw conversationsError
    const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation]))

    const rowsByConversation = new Map<string, typeof data>()
    for (const row of data) {
      const group = rowsByConversation.get(row.conversation_id)
      if (group) group.push(row)
      else rowsByConversation.set(row.conversation_id, [row])
    }

    const results: SearchResult[] = []
    for (const [conversationId, rows] of rowsByConversation) {
      const conversation = conversationById.get(conversationId)
      if (!conversation) continue

      const bestRow = rows.reduce((best, row) => (row.similarity > best.similarity ? row : best))
      const score = computeConversationScore({
        topSimilarity: bestRow.similarity,
        matchCount: rows.length,
        updatedAt: conversation.updated_at,
      })

      results.push({
        sourceType: 'conversation',
        sourceId: conversationId,
        title: conversation.title,
        snippet: bestRow.content,
        similarity: score,
        // Deep-links straight to the strongest-matching message so the
        // reader doesn't have to hunt through the whole thread for it.
        href: `/chat?conversationId=${conversationId}&messageId=${bestRow.message_id}`,
        matchCount: rows.length,
        updatedAt: conversation.updated_at,
        workspaceId: conversation.workspace_id,
      })
    }

    return results
  },
}
