import { supabase } from '@/shared/lib/supabase'
import type { KnowledgeLink } from '@/shared/types/database'

/**
 * The only genuinely new query this phase needs — every node type
 * (documents, notes, highlights, tags) already has a list function
 * elsewhere (listDocuments, listNotes, listRecentHighlights, listTags);
 * this module composes them rather than duplicating them. See
 * useKnowledgeGraph for the composition.
 *
 * knowledge_links does have a workspace_id column (nullable, unlike
 * highlights/chapter_summaries/flashcards which lack one entirely), so
 * we can filter by it directly when a workspace is selected. RLS is
 * still the primary scoping guard either way — as of UX-14.5 Phase 4
 * that's `auth.uid() = user_id OR has_workspace_role(workspace_id,
 * 'viewer')`, not single-owner-only, so a shared workspace's links from
 * every member surface here with no change needed to this query.
 */
export async function listKnowledgeLinks(workspaceId: string | null, limit = 200): Promise<KnowledgeLink[]> {
  let query = supabase
    .from('knowledge_links')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (workspaceId) query = query.eq('workspace_id', workspaceId)

  const { data, error } = await query
  if (error) throw error
  return data
}
