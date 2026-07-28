import { supabase } from '@/shared/lib/supabase'
import type { KnowledgeLink } from '@/shared/types/database'

// Minimal, notes-scoped use of the generic knowledge_links table (reconciled
// in the schema-foundation phase) — just enough to support "attach note to
// highlight" for this phase. A general-purpose knowledge module (listing/
// visualizing arbitrary links) is out of scope here; see the Phase 4 audit's
// roadmap for that as a dedicated future phase.
export async function linkNoteToHighlight(params: {
  userId: string
  workspaceId: string | null
  noteId: string
  highlightId: string
}): Promise<KnowledgeLink> {
  const { data, error } = await supabase
    .from('knowledge_links')
    .insert({
      user_id: params.userId,
      workspace_id: params.workspaceId,
      source_type: 'note',
      source_id: params.noteId,
      target_type: 'highlight',
      target_id: params.highlightId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}
