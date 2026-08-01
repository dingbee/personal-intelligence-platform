import { supabase } from '@/shared/lib/supabase'
import type { SearchProvider, SearchQuery, SearchResult } from '@/modules/search/types'
import { computeConversationScore } from '@/modules/search/ranking/conversationScore'
import { LEXICAL_ONLY_BASE_SCORE, applyLexicalBoost } from '@/modules/search/ranking/hybridScore'

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
    let lexicalQuery = supabase
      .from('conversations')
      .select('id, title, workspace_id, updated_at')
      .ilike('title', `%${query.queryText}%`)
      .limit(query.matchCount)
    if (query.workspaceId) lexicalQuery = lexicalQuery.eq('workspace_id', query.workspaceId)

    const [semanticResult, lexicalResult] = await Promise.all([
      supabase.rpc('match_messages', {
        query_embedding: query.queryEmbedding,
        match_count: query.matchCount,
        filter_workspace_id: query.workspaceId,
      }),
      lexicalQuery,
    ])
    if (semanticResult.error) throw semanticResult.error
    if (lexicalResult.error) throw lexicalResult.error

    const data = semanticResult.data
    const lexicalConversations = lexicalResult.data
    if (data.length === 0 && lexicalConversations.length === 0) return []

    const semanticOnlyIds = Array.from(new Set(data.map((row) => row.conversation_id))).filter(
      (id) => !lexicalConversations.some((conversation) => conversation.id === id),
    )
    const { data: extraConversations, error: extraConversationsError } =
      semanticOnlyIds.length > 0
        ? await supabase.from('conversations').select('id, title, workspace_id, updated_at').in('id', semanticOnlyIds)
        : { data: [], error: null }
    if (extraConversationsError) throw extraConversationsError
    const conversationById = new Map([...lexicalConversations, ...extraConversations].map((conversation) => [conversation.id, conversation]))
    const lexicalIds = new Set(lexicalConversations.map((conversation) => conversation.id))

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
      // Recency is applied uniformly across all sources by runUniversalSearch
      // (applyRecencyBonus), not here — only the conversation-specific
      // support bonus (several corroborating messages) belongs in this score.
      // UX-13.11 Phase 3 — a title match on top of that support bonus is a
      // further, independent corroborating signal, applied as a boost.
      const score = applyLexicalBoost(
        computeConversationScore({ topSimilarity: bestRow.similarity, matchCount: rows.length }),
        lexicalIds.has(conversationId),
      )

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

    // A conversation whose title matches but whose messages never scored
    // highly enough semantically to appear above — still surfaces, just at
    // the lexical-only base score, with no specific message to deep-link to.
    for (const conversation of lexicalConversations) {
      if (rowsByConversation.has(conversation.id)) continue
      results.push({
        sourceType: 'conversation',
        sourceId: conversation.id,
        title: conversation.title,
        snippet: 'Matched by conversation title.',
        similarity: LEXICAL_ONLY_BASE_SCORE,
        href: `/chat?conversationId=${conversation.id}`,
        updatedAt: conversation.updated_at,
        workspaceId: conversation.workspace_id,
      })
    }

    return results
  },
}
