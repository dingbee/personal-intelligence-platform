import { supabase } from '@/shared/lib/supabase'
import type { SearchProvider, SearchQuery, SearchResult } from '@/modules/search/types'

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
      .select('id, title')
      .in('id', conversationIds)
    if (conversationsError) throw conversationsError
    const titleById = new Map(conversations.map((conversation) => [conversation.id, conversation.title]))

    return data.map((row) => ({
      sourceType: 'conversation',
      sourceId: row.conversation_id,
      title: titleById.get(row.conversation_id) ?? 'Conversation',
      snippet: row.content,
      similarity: row.similarity,
      href: `/chat?conversationId=${row.conversation_id}`,
    }))
  },
}
