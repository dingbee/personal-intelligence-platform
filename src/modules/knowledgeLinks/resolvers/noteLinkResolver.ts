import { supabase } from '@/shared/lib/supabase'
import type { LinkResolver, LinkableItem } from '@/modules/knowledgeLinks/types'

export const noteLinkResolver: LinkResolver = {
  id: 'note',

  async resolve(ids): Promise<LinkableItem[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase.from('notes').select('id, title').in('id', ids)
    if (error) throw error
    return data.map((note) => ({
      type: 'note',
      id: note.id,
      title: note.title || 'Untitled note',
      href: `/notes/${note.id}`,
    }))
  },

  async search(queryText, ctx): Promise<LinkableItem[]> {
    const { data, error } = await supabase
      .from('notes')
      .select('id, title')
      .eq('user_id', ctx.userId)
      .ilike('title', `%${queryText}%`)
      .limit(10)
    if (error) throw error
    return data.map((note) => ({
      type: 'note',
      id: note.id,
      title: note.title || 'Untitled note',
      href: `/notes/${note.id}`,
    }))
  },
}
