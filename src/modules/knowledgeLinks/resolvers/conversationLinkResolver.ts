import { supabase } from '@/shared/lib/supabase'
import type { LinkResolver, LinkableItem } from '@/modules/knowledgeLinks/types'

export const conversationLinkResolver: LinkResolver = {
  id: 'conversation',

  async resolve(ids): Promise<LinkableItem[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase.from('conversations').select('id, title').in('id', ids)
    if (error) throw error
    return data.map((conversation) => ({
      type: 'conversation',
      id: conversation.id,
      title: conversation.title || 'Conversation',
      href: `/chat?conversationId=${conversation.id}`,
    }))
  },

  async search(queryText, ctx): Promise<LinkableItem[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title')
      .eq('user_id', ctx.userId)
      .ilike('title', `%${queryText}%`)
      .limit(10)
    if (error) throw error
    return data.map((conversation) => ({
      type: 'conversation',
      id: conversation.id,
      title: conversation.title || 'Conversation',
      href: `/chat?conversationId=${conversation.id}`,
    }))
  },
}
