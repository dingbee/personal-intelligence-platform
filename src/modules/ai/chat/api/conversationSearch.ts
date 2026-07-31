import { supabase } from '@/shared/lib/supabase'
import type { Conversation } from '@/shared/types/database'

/**
 * UX-13.5 Phase 9 — combines the two independent search sources (title
 * match, message-content match) into one deduplicated, most-recent-first
 * list. Pure so the merge/dedup/sort logic is unit-testable without a
 * Supabase mock; searchConversations below is the only caller.
 */
export function mergeConversationSearchResults(byTitle: Conversation[], byMessage: Conversation[]): Conversation[] {
  const byId = new Map<string, Conversation>()
  for (const conversation of byTitle) byId.set(conversation.id, conversation)
  for (const conversation of byMessage) byId.set(conversation.id, conversation)
  return [...byId.values()].sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
}

/**
 * UX-13.5 Phase 9 — searches active conversations by title and by message
 * content ("topics" from the brief has no dedicated storage — see the
 * Phase 1 audit — so a title/content match is the closest real signal;
 * conversation titles are now intent-capturing per Phase A, which makes
 * title search a reasonable proxy for topic search). Archived conversations
 * are intentionally excluded — search operates on the same default,
 * active-only scope listConversations does.
 */
export async function searchConversations(params: {
  userId: string
  workspaceId: string | null
  documentId?: string
  query: string
}): Promise<Conversation[]> {
  let titleQuery = supabase.from('conversations').select('*').is('archived_at', null).ilike('title', `%${params.query}%`)
  if (params.documentId) titleQuery = titleQuery.eq('document_id', params.documentId)
  else if (params.workspaceId) titleQuery = titleQuery.eq('workspace_id', params.workspaceId)

  let messageMatchQuery = supabase
    .from('messages')
    .select('conversation_id, conversations!inner(*)')
    .is('conversations.archived_at', null)
    .ilike('content', `%${params.query}%`)
  if (params.documentId) messageMatchQuery = messageMatchQuery.eq('conversations.document_id', params.documentId)
  else if (params.workspaceId) messageMatchQuery = messageMatchQuery.eq('conversations.workspace_id', params.workspaceId)

  const [titleResult, messageResult] = await Promise.all([titleQuery, messageMatchQuery])
  if (titleResult.error) throw titleResult.error
  if (messageResult.error) throw messageResult.error

  const byMessage = (messageResult.data as unknown as { conversations: Conversation }[]).map((row) => row.conversations)
  return mergeConversationSearchResults(titleResult.data, byMessage)
}
