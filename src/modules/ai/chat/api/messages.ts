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
