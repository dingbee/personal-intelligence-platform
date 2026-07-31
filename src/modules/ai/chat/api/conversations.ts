import { supabase } from '@/shared/lib/supabase'
import type { Conversation } from '@/shared/types/database'
import { DEFAULT_CHAT_PROVIDER_ID } from '@/modules/ai/providers/registry'
import { listMessages, insertMessage } from '@/modules/ai/chat/api/messages'

/**
 * UX-13.5B — active (non-archived) conversations only, the default list
 * every existing caller (ChatPage, PersonalIntelligenceTimeline,
 * dashboardInteraction) expects. UX-13.6: pinned conversations sort
 * first regardless of recency (is_pinned desc), most-recently-active
 * first within each group — the same "pinned items float to the top"
 * convention as everywhere else pinning exists.
 */
export async function listConversations(params: {
  workspaceId: string | null
  documentId?: string
}): Promise<Conversation[]> {
  let query = supabase
    .from('conversations')
    .select('*')
    .is('archived_at', null)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })

  if (params.documentId) query = query.eq('document_id', params.documentId)
  else if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId)

  const { data, error } = await query
  if (error) throw error
  return data
}

/** UX-13.5B — the archive view: hidden from the default list but still fully queryable/restorable. Ordered by when each was archived, most-recent-first. */
export async function listArchivedConversations(params: {
  workspaceId: string | null
  documentId?: string
}): Promise<Conversation[]> {
  let query = supabase
    .from('conversations')
    .select('*')
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })

  if (params.documentId) query = query.eq('document_id', params.documentId)
  else if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getConversation(id: string): Promise<Conversation> {
  const { data, error } = await supabase.from('conversations').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createConversation(params: {
  userId: string
  workspaceId: string | null
  documentId?: string | null
  title?: string
  providerId?: string
}): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: params.userId,
      workspace_id: params.workspaceId,
      document_id: params.documentId ?? null,
      title: params.title ?? 'New conversation',
      provider_id: params.providerId ?? DEFAULT_CHAT_PROVIDER_ID,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('conversations').update({ title }).eq('id', id)
  if (error) throw error
}

/** Changes which provider future messages in this conversation use — historical messages are untouched, since providerId isn't stored per-message. */
export async function updateConversationProvider(id: string, providerId: string): Promise<void> {
  const { error } = await supabase.from('conversations').update({ provider_id: providerId }).eq('id', id)
  if (error) throw error
}

export async function touchConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** UX-13.5B — hides a conversation from the default list without deleting it. Reversible via restoreConversation. */
export async function archiveConversation(id: string): Promise<void> {
  const { error } = await supabase.from('conversations').update({ archived_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** UX-13.5B — the inverse of archiveConversation; brings a conversation back into the default list. */
export async function restoreConversation(id: string): Promise<void> {
  const { error } = await supabase.from('conversations').update({ archived_at: null }).eq('id', id)
  if (error) throw error
}

/** UX-13.6 — pin/unpin: pinned conversations sort first in listConversations regardless of recency. Independent of favorite (a conversation can be either, both, or neither). */
export async function setConversationPinned(id: string, isPinned: boolean): Promise<void> {
  const { error } = await supabase.from('conversations').update({ is_pinned: isPinned }).eq('id', id)
  if (error) throw error
}

/** UX-13.6 — favorite/unfavorite: a separate signal from pinning (doesn't affect list order), for a future "Favorites" filter/view. */
export async function setConversationFavorite(id: string, favorite: boolean): Promise<void> {
  const { error } = await supabase.from('conversations').update({ favorite }).eq('id', id)
  if (error) throw error
}

/** Permanent, unrecoverable removal — a deliberate second action distinct from archiving; the UI requires explicit confirmation before calling this. */
export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', id)
  if (error) throw error
}

/**
 * UX-13.5B — clones a conversation's identity (title, provider, workspace/
 * document scope) and its full message history into a brand-new
 * conversation, so a user can branch off an existing thread without
 * touching the original. Messages are inserted one at a time (not via
 * Promise.all) so their created_at ordering — the only thing listMessages
 * sorts by — matches the source conversation's order exactly.
 */
export async function duplicateConversation(id: string, userId: string): Promise<Conversation> {
  const [source, messages] = await Promise.all([getConversation(id), listMessages(id)])
  const copy = await createConversation({
    userId,
    workspaceId: source.workspace_id,
    documentId: source.document_id,
    title: `${source.title} (Copy)`,
    providerId: source.provider_id,
  })
  for (const message of messages) {
    await insertMessage({
      conversationId: copy.id,
      userId,
      role: message.role,
      content: message.content,
      contextChunkIds: message.context_chunk_ids,
    })
  }
  return copy
}
