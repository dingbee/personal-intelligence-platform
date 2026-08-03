import { supabase } from '@/shared/lib/supabase'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import type { CollectionItemType } from '@/modules/knowledge-intelligence/api/knowledgeCollections'

export interface CollectionMembershipLink {
  itemType: CollectionItemType
  itemId: string
  createdAt: string
}

/**
 * UX-14.5.10.6 — the one place this package type does real I/O before
 * building its (otherwise pure/synchronous) manifest, mirroring
 * `knowledgeLinkFetch.ts`'s own role. `knowledgeCollections.ts`'s own
 * `listCollectionItems` already runs this exact query, but resolves it
 * into display-ready `EvidenceItem`s (titles only) — Export needs the raw
 * `(itemType, itemId, createdAt)` triples instead, so this is a second,
 * narrower read of the same rows, not a duplicate of that function's own
 * logic.
 */
export async function fetchCollectionMembershipLinks(collectionId: string): Promise<CollectionMembershipLink[]> {
  const { data, error } = await supabase
    .from('knowledge_links')
    .select('*')
    .eq('source_type', 'knowledge_collection')
    .eq('source_id', collectionId)
  if (error) throw error
  return (data as KnowledgeLink[]).map((link) => ({
    itemType: link.target_type as CollectionItemType,
    itemId: link.target_id,
    createdAt: link.created_at,
  }))
}

/** A single `knowledge_nodes` row by id — the one member type with no existing dedicated single-row getter (Notes/Assets/Documents already have `getNote`/`getAsset`/`getDocumentWithTags`). */
export async function fetchKnowledgeNodeById(id: string): Promise<KnowledgeNode> {
  const { data, error } = await supabase.from('knowledge_nodes').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

/**
 * Every `knowledge_links` edge where **both** endpoints are `knowledge_node`
 * ids within the given set — the discovery's §2.6 "auxiliary relationships"
 * concern: a collection whose members include several interconnected
 * concepts plausibly has real edges *between* those specific nodes, and
 * losing them on export would understate what the collection represents.
 */
export async function fetchRelationshipsAmongNodes(nodeIds: string[]): Promise<KnowledgeLink[]> {
  if (nodeIds.length < 2) return []
  const { data, error } = await supabase
    .from('knowledge_links')
    .select('*')
    .eq('source_type', 'knowledge_node')
    .eq('target_type', 'knowledge_node')
    .in('source_id', nodeIds)
    .in('target_id', nodeIds)
  if (error) throw error
  return data
}
