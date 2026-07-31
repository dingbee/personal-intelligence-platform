import { supabase } from '@/shared/lib/supabase'
import type { KnowledgeNode, KnowledgeNodeType } from '@/shared/types/database'
import { normalizeTitle } from '@/modules/knowledge-intelligence/utils/normalizeTitle'

export interface ResolveCanonicalNodeInput {
  userId: string
  workspaceId: string | null
  nodeType: KnowledgeNodeType
  title: string
  description: string | null
  sourceType: string
  sourceId: string
  sourceChunkIds: string[]
  generationMetadata: Record<string, unknown>
  metadata?: Record<string, unknown> | null
}

export interface ResolveCanonicalNodeResult {
  node: KnowledgeNode
  created: boolean
}

export type ResolutionAction =
  /** No existing node for this (user, type, normalized title) — insert one. */
  | 'create'
  /** An existing node already came from this exact source (e.g. the same document re-extracting) — refresh its content, matching the pre-Phase-9A upsert behavior for that case exactly. */
  | 'refresh'
  /** An existing node came from a *different* source — this is the cross-document merge case. Reuse it as-is; don't let a later document's possibly-different description clobber the established one. Only its provenance (knowledge_node_sources) gets a new row. */
  | 'reuse'

/**
 * Pure decision function — no I/O, fully unit-testable without a database.
 * Kept separate from resolveCanonicalNode below so the actual dedup/merge
 * *logic* has test coverage independent of Supabase.
 */
export function decideResolutionAction(
  existing: Pick<KnowledgeNode, 'source_type' | 'source_id'> | null,
  input: { sourceType: string; sourceId: string },
): ResolutionAction {
  if (!existing) return 'create'
  if (existing.source_type === input.sourceType && existing.source_id === input.sourceId) return 'refresh'
  return 'reuse'
}

/**
 * Find-or-create a canonical node by (user_id, node_type, normalized
 * title) — exact-normalized matching only, no fuzzy matching (Phase 9A
 * scope). Always records this call's source in knowledge_node_sources,
 * whether the node was just created, refreshed, or reused, so a concept/
 * entity accumulates a complete provenance ledger across every document
 * it's ever extracted from — not just the first.
 *
 * No hard DB uniqueness backs this lookup (see migration 0016) — a benign
 * race between two concurrent resolutions of the same brand-new title
 * could in theory create two rows. Extraction is a single user-triggered
 * mutation per document today, not run with meaningful concurrency, so
 * this is an accepted, documented trade-off rather than a solved one.
 */
export async function resolveCanonicalNode(input: ResolveCanonicalNodeInput): Promise<ResolveCanonicalNodeResult> {
  const titleNormalized = normalizeTitle(input.title)

  const { data: existing, error: lookupError } = await supabase
    .from('knowledge_nodes')
    .select('*')
    .eq('user_id', input.userId)
    .eq('node_type', input.nodeType)
    .eq('title_normalized', titleNormalized)
    .maybeSingle()
  if (lookupError) throw lookupError

  const action = decideResolutionAction(existing, { sourceType: input.sourceType, sourceId: input.sourceId })

  let node: KnowledgeNode
  if (action === 'create') {
    const { data: inserted, error: insertError } = await supabase
      .from('knowledge_nodes')
      .insert({
        user_id: input.userId,
        workspace_id: input.workspaceId,
        node_type: input.nodeType,
        title: input.title,
        title_normalized: titleNormalized,
        description: input.description,
        source_type: input.sourceType,
        source_id: input.sourceId,
        source_chunk_ids: input.sourceChunkIds,
        generation_metadata: input.generationMetadata,
        metadata: input.metadata ?? null,
      })
      .select()
      .single()
    if (insertError) throw insertError
    node = inserted
  } else if (action === 'refresh') {
    const { data: updated, error: updateError } = await supabase
      .from('knowledge_nodes')
      .update({
        title: input.title,
        description: input.description,
        source_chunk_ids: input.sourceChunkIds,
        generation_metadata: input.generationMetadata,
        metadata: input.metadata ?? null,
      })
      .eq('id', existing!.id)
      .select()
      .single()
    if (updateError) throw updateError
    node = updated
  } else {
    node = existing!
  }

  await recordKnowledgeNodeSource({
    userId: input.userId,
    nodeId: node.id,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceChunkIds: input.sourceChunkIds,
  })

  return { node, created: action === 'create' }
}

/**
 * Exported (Phase 2B) so a deterministic concept *matcher* — matching
 * already-known nodes into new note/conversation text — can record
 * evidence without going through the full resolveCanonicalNode path,
 * which is for the LLM extraction pipeline that discovers/refreshes
 * nodes. Matching never creates or refreshes a node, only links one.
 */
export async function recordKnowledgeNodeSource(input: {
  userId: string
  nodeId: string
  sourceType: string
  sourceId: string
  sourceChunkIds: string[]
}): Promise<void> {
  const { error } = await supabase.from('knowledge_node_sources').upsert(
    {
      user_id: input.userId,
      node_id: input.nodeId,
      source_type: input.sourceType,
      source_id: input.sourceId,
      source_chunk_ids: input.sourceChunkIds,
    },
    { onConflict: 'node_id,source_type,source_id' },
  )
  if (error) throw error
}
