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
 * ARRIYIA Product Completion Phase 2 — opening a long-lived conversation
 * used to load its entire history unbounded (listMessages above). Larger
 * than buildChatHistory's own MAX_HISTORY_MESSAGES (40) so a fresh
 * conversation load always has enough messages already in view to fill
 * the AI's own history window without requiring the user to click "Load
 * older messages" first.
 */
export const MESSAGES_PAGE_SIZE = 50

export interface MessagesPage {
  /** Oldest-first, matching listMessages' own ordering. */
  messages: Message[]
  /** True when at least one older message exists beyond this page. */
  hasMore: boolean
}

/**
 * One page of a conversation's messages, newest-first under the hood
 * (so LIMIT actually bounds "the most recent N") then reversed back to
 * the ascending order every caller/renderer already expects.
 * `beforeCreatedAt` omitted fetches the most recent page (the initial
 * load); passed, fetches the page immediately older than it — used by
 * both useMessages' first fetch and its loadOlder().
 */
export async function listMessagesPage(conversationId: string, beforeCreatedAt?: string): Promise<MessagesPage> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE + 1) // one extra row reveals hasMore without a separate count query
  if (beforeCreatedAt) query = query.lt('created_at', beforeCreatedAt)
  const { data, error } = await query
  if (error) throw error
  const hasMore = data.length > MESSAGES_PAGE_SIZE
  const page = data.slice(0, MESSAGES_PAGE_SIZE).reverse()
  return { messages: page, hasMore }
}

/**
 * Every message from `sinceCreatedAt` (inclusive) to now — the open upper
 * bound that keeps the currently-visible window safe to refetch/invalidate
 * on every send: unlike a fixed-size "latest N" query, this can never drop
 * an already-shown message just because a new one arrived, since it only
 * ever grows forward from a fixed lower boundary.
 */
export async function listMessagesSince(conversationId: string, sinceCreatedAt: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .gte('created_at', sinceCreatedAt)
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
