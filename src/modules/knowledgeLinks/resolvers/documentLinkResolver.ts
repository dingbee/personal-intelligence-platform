import { supabase } from '@/shared/lib/supabase'
import type { LinkResolver, LinkableItem } from '@/modules/knowledgeLinks/types'

// Only ready EPUBs have a dedicated reader page — every other document
// (or an EPUB still processing) links back to the library instead of a
// per-document page that doesn't exist yet.
function hrefFor(document: { id: string; file_type: string; status: string }) {
  return document.file_type === 'epub' && document.status === 'ready'
    ? `/library/${document.id}/read`
    : '/library'
}

export const documentLinkResolver: LinkResolver = {
  id: 'document',

  async resolve(ids): Promise<LinkableItem[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase.from('documents').select('id, title, file_type, status').in('id', ids)
    if (error) throw error
    return data.map((document) => ({
      type: 'document',
      id: document.id,
      title: document.title,
      href: hrefFor(document),
    }))
  },

  async search(queryText, ctx): Promise<LinkableItem[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, file_type, status')
      .eq('user_id', ctx.userId)
      .ilike('title', `%${queryText}%`)
      .limit(10)
    if (error) throw error
    return data.map((document) => ({
      type: 'document',
      id: document.id,
      title: document.title,
      href: hrefFor(document),
    }))
  },
}
