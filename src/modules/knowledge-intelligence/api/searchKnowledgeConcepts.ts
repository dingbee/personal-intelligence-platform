import { supabase } from '@/shared/lib/supabase'
import type { KnowledgeNode } from '@/shared/types/database'

/**
 * UX-13.11 Phase 2B — the Graph Layer branch of Universal Search. Title
 * substring match, not embedding similarity: knowledge_nodes deliberately
 * has no embedding column of its own (it's meant to ride document_chunks'
 * via source_chunk_ids, per migration 0012's comment), and a literal
 * "find Revenue" query doesn't need semantic search anyway. Global across
 * workspaces — node identity already is (resolveCanonicalNode dedups on
 * user_id + title only), so search matches that.
 */
export async function searchKnowledgeConcepts(queryText: string, userId: string, limit = 5): Promise<KnowledgeNode[]> {
  const trimmed = queryText.trim()
  if (!trimmed) return []

  const { data, error } = await supabase
    .from('knowledge_nodes')
    .select('*')
    .eq('user_id', userId)
    .ilike('title', `%${trimmed}%`)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
