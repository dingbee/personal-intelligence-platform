import { supabase } from '@/shared/lib/supabase'
import type { LinkResolver, LinkableItem } from '@/modules/knowledgeLinks/types'

const PREVIEW_LENGTH = 80

function titleFor(quote: string) {
  return quote.length > PREVIEW_LENGTH ? `${quote.slice(0, PREVIEW_LENGTH)}…` : quote
}

export const highlightLinkResolver: LinkResolver = {
  id: 'highlight',

  async resolve(ids): Promise<LinkableItem[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase.from('highlights').select('id, quote, document_id').in('id', ids)
    if (error) throw error
    return data.map((highlight) => ({
      type: 'highlight',
      id: highlight.id,
      title: titleFor(highlight.quote),
      href: `/library/${highlight.document_id}/read`,
    }))
  },

  async search(queryText, ctx): Promise<LinkableItem[]> {
    const { data, error } = await supabase
      .from('highlights')
      .select('id, quote, document_id')
      .eq('user_id', ctx.userId)
      .ilike('quote', `%${queryText}%`)
      .limit(10)
    if (error) throw error
    return data.map((highlight) => ({
      type: 'highlight',
      id: highlight.id,
      title: titleFor(highlight.quote),
      href: `/library/${highlight.document_id}/read`,
    }))
  },
}
