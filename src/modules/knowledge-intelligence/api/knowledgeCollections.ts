import { supabase } from '@/shared/lib/supabase'
import type { KnowledgeCollection, KnowledgeLink } from '@/shared/types/database'
import type { EvidenceItem } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'

/** The item types a Knowledge Collection can hold — matches the source/target types already used elsewhere in knowledge_links (see linkNoteToHighlight/linkNoteToConversation/linkNoteToAsset, and knowledgeNodeEvidence's source types). */
export type CollectionItemType = 'document' | 'note' | 'conversation' | 'asset' | 'knowledge_node'

const MEMBERSHIP_SOURCE_TYPE = 'knowledge_collection'

export interface CollectionFilters {
  workspaceId?: string | null
}

export async function listKnowledgeCollections(filters: CollectionFilters = {}): Promise<KnowledgeCollection[]> {
  let query = supabase.from('knowledge_collections').select('*').order('updated_at', { ascending: false })
  if (filters.workspaceId) query = query.eq('workspace_id', filters.workspaceId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getKnowledgeCollection(id: string): Promise<KnowledgeCollection> {
  const { data, error } = await supabase.from('knowledge_collections').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createKnowledgeCollection(params: {
  userId: string
  workspaceId: string | null
  name: string
  description?: string
}): Promise<KnowledgeCollection> {
  const { data, error } = await supabase
    .from('knowledge_collections')
    .insert({ user_id: params.userId, workspace_id: params.workspaceId, name: params.name, description: params.description ?? null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateKnowledgeCollection(
  id: string,
  updates: Partial<Pick<KnowledgeCollection, 'name' | 'description'>>,
): Promise<KnowledgeCollection> {
  const { data, error } = await supabase.from('knowledge_collections').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

/** Deletes the collection and every membership link that points at it — knowledge_links has no FK to knowledge_collections (it's the same unenforced-string-type pattern every other polymorphic link uses), so cleanup is explicit rather than a cascade. */
export async function deleteKnowledgeCollection(id: string): Promise<void> {
  const { error: linksError } = await supabase
    .from('knowledge_links')
    .delete()
    .eq('source_type', MEMBERSHIP_SOURCE_TYPE)
    .eq('source_id', id)
  if (linksError) throw linksError

  const { error } = await supabase.from('knowledge_collections').delete().eq('id', id)
  if (error) throw error
}

export async function addItemToCollection(params: {
  userId: string
  workspaceId: string | null
  collectionId: string
  itemType: CollectionItemType
  itemId: string
}): Promise<KnowledgeLink> {
  const { data, error } = await supabase
    .from('knowledge_links')
    .insert({
      user_id: params.userId,
      workspace_id: params.workspaceId,
      source_type: MEMBERSHIP_SOURCE_TYPE,
      source_id: params.collectionId,
      target_type: params.itemType,
      target_id: params.itemId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeItemFromCollection(params: {
  collectionId: string
  itemType: CollectionItemType
  itemId: string
}): Promise<void> {
  const { error } = await supabase
    .from('knowledge_links')
    .delete()
    .eq('source_type', MEMBERSHIP_SOURCE_TYPE)
    .eq('source_id', params.collectionId)
    .eq('target_type', params.itemType)
    .eq('target_id', params.itemId)
  if (error) throw error
}

/**
 * Resolves membership links into display-ready items — same
 * multi-table-title-resolution shape as getKnowledgeNodeEvidence
 * (EvidenceItem: {type, id, label, createdAt}), reused here rather than
 * inventing a parallel shape, so SourceReference renders both identically.
 */
export async function listCollectionItems(collectionId: string): Promise<EvidenceItem[]> {
  const { data: links, error } = await supabase
    .from('knowledge_links')
    .select('*')
    .eq('source_type', MEMBERSHIP_SOURCE_TYPE)
    .eq('source_id', collectionId)
  if (error) throw error

  const idsByType = new Map<CollectionItemType, string[]>()
  for (const link of links) {
    const type = link.target_type as CollectionItemType
    const list = idsByType.get(type) ?? []
    list.push(link.target_id)
    idsByType.set(type, list)
  }

  const [documents, notes, conversations, assets, knowledgeNodes] = await Promise.all([
    fetchTitles('documents', idsByType.get('document')),
    fetchTitles('notes', idsByType.get('note')),
    fetchTitles('conversations', idsByType.get('conversation')),
    fetchTitles('assets', idsByType.get('asset')),
    fetchTitles('knowledge_nodes', idsByType.get('knowledge_node')),
  ])

  const titleById = new Map<string, string>()
  for (const row of [...documents, ...notes, ...conversations, ...assets, ...knowledgeNodes]) titleById.set(row.id, row.title)

  const items: EvidenceItem[] = []
  for (const link of links) {
    const label = titleById.get(link.target_id)
    if (!label) continue
    items.push({ type: link.target_type, id: link.target_id, label, createdAt: link.created_at })
  }
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return items
}

async function fetchTitles(table: string, ids: string[] | undefined): Promise<{ id: string; title: string }[]> {
  if (!ids || ids.length === 0) return []
  const { data, error } = await supabase.from(table).select('id, title').in('id', ids)
  if (error) throw error
  return data
}
