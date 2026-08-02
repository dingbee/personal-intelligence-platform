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

/** UX-13.7.2 — "Save conversation to Notes" provenance: connects the created note back to the conversation it was saved from, same polymorphic knowledge_links pattern as linkNoteToHighlight above. */
export async function linkNoteToConversation(params: {
  userId: string
  workspaceId: string | null
  noteId: string
  conversationId: string
}): Promise<KnowledgeLink> {
  const { data, error } = await supabase
    .from('knowledge_links')
    .insert({
      user_id: params.userId,
      workspace_id: params.workspaceId,
      source_type: 'note',
      source_id: params.noteId,
      target_type: 'conversation',
      target_id: params.conversationId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** UX-13.9 — "Save image to Notes" provenance: connects the created note back to the asset it was saved from, same polymorphic knowledge_links pattern. No new table — assets was deliberately kept generic-link-compatible (source_type/target_type are plain strings, not FK-enforced). */
export async function linkNoteToAsset(params: {
  userId: string
  workspaceId: string | null
  noteId: string
  assetId: string
}): Promise<KnowledgeLink> {
  const { data, error } = await supabase
    .from('knowledge_links')
    .insert({
      user_id: params.userId,
      workspace_id: params.workspaceId,
      source_type: 'note',
      source_id: params.noteId,
      target_type: 'asset',
      target_id: params.assetId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** AI Workspace Actions v1 — "Save to Notes" message-level provenance: connects the created note back to the exact chat message it was saved from, same polymorphic knowledge_links pattern as the three functions above (target_type='message' needs no schema change). */
export async function linkNoteToMessage(params: {
  userId: string
  workspaceId: string | null
  noteId: string
  messageId: string
}): Promise<KnowledgeLink> {
  const { data, error } = await supabase
    .from('knowledge_links')
    .insert({
      user_id: params.userId,
      workspace_id: params.workspaceId,
      source_type: 'note',
      source_id: params.noteId,
      target_type: 'message',
      target_id: params.messageId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * UX-14.4.3 — the minimum primitive for linking an artifact to a related
 * memory, same polymorphic knowledge_links pattern as the four functions
 * above (target_type='memory' needs no schema change — source_type/
 * target_type are plain text columns with no CHECK constraint or enum,
 * confirmed against every migration). Deliberately just the write
 * primitive: no caller in this codebase invokes this yet. Automatic
 * "which memories relate to this artifact" matching is intentionally not
 * built here — `matchKnownConcepts` (the existing knowledge-linking
 * algorithm) matches short concept *titles*, which doesn't transfer to
 * full-sentence memory *content*, and inventing a new relevance heuristic
 * (or plumbing individual memory ids through retrieveMemoryContext's
 * string-only return type) is exactly the speculative-architecture /
 * retrieval-redesign this milestone's constraints exclude. This is future
 * work — see docs/ux-14.4.3-artifact-experience-layer-discovery.md §2 and
 * the UX-14.4.3 implementation record.
 */
export async function linkNoteToMemory(params: {
  userId: string
  workspaceId: string | null
  noteId: string
  memoryId: string
}): Promise<KnowledgeLink> {
  const { data, error } = await supabase
    .from('knowledge_links')
    .insert({
      user_id: params.userId,
      workspace_id: params.workspaceId,
      source_type: 'note',
      source_id: params.noteId,
      target_type: 'memory',
      target_id: params.memoryId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}
