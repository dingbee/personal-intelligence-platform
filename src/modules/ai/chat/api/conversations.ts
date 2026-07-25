import { supabase } from '@/shared/lib/supabase'
import type { Conversation } from '@/shared/types/database'
import { DEFAULT_CHAT_PROVIDER_ID } from '@/modules/ai/providers/registry'

export async function listConversations(params: {
  workspaceId: string | null
  documentId?: string
}): Promise<Conversation[]> {
  let query = supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })

  if (params.documentId) query = query.eq('document_id', params.documentId)
  else if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId)

  const { data, error } = await query
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

export async function touchConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', id)
  if (error) throw error
}
