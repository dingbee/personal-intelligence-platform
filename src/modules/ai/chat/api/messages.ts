import { supabase } from '@/shared/lib/supabase'
import type { Message, MessageRole } from '@/shared/types/database'

export async function listMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/**
 * AI Experience Intelligence v1 — one query for the last message's role
 * across several conversations, used to detect a genuinely unresolved
 * exchange (last message role === 'user', i.e. it never got an assistant
 * reply — normally impossible since sendMessage always awaits a reply, so
 * this only fires on an interrupted/failed turn). Ordered desc and reduced
 * to first-seen-per-conversation client-side rather than N queries.
 */
export async function listLastMessageRoles(conversationIds: string[]): Promise<Map<string, MessageRole>> {
  if (conversationIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('messages')
    .select('conversation_id, role, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  const result = new Map<string, MessageRole>()
  for (const row of data) {
    if (!result.has(row.conversation_id)) result.set(row.conversation_id, row.role)
  }
  return result
}

export async function insertMessage(params: {
  conversationId: string
  userId: string
  role: MessageRole
  content: string
  contextChunkIds?: string[]
}): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: params.conversationId,
      user_id: params.userId,
      role: params.role,
      content: params.content,
      context_chunk_ids: params.contextChunkIds ?? [],
    })
    .select()
    .single()
  if (error) throw error
  return data
}
