import { supabase } from '@/shared/lib/supabase'
import type { LinkResolver, LinkableItem } from '@/modules/knowledgeLinks/types'

export const flashcardLinkResolver: LinkResolver = {
  id: 'flashcard',

  async resolve(ids): Promise<LinkableItem[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase.from('flashcards').select('id, front, document_id').in('id', ids)
    if (error) throw error
    return data.map((flashcard) => ({
      type: 'flashcard',
      id: flashcard.id,
      title: flashcard.front,
      href: `/library/${flashcard.document_id}/read`,
    }))
  },

  async search(queryText, ctx): Promise<LinkableItem[]> {
    const { data, error } = await supabase
      .from('flashcards')
      .select('id, front, document_id')
      .eq('user_id', ctx.userId)
      .ilike('front', `%${queryText}%`)
      .limit(10)
    if (error) throw error
    return data.map((flashcard) => ({
      type: 'flashcard',
      id: flashcard.id,
      title: flashcard.front,
      href: `/library/${flashcard.document_id}/read`,
    }))
  },
}
