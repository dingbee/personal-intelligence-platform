import { supabase } from '@/shared/lib/supabase'
import type { KnowledgeLink } from '@/shared/types/database'
import type { LinkableType } from '@/modules/knowledgeLinks/types'

export interface LinkEdge {
  linkId: string
  otherType: LinkableType
  otherId: string
}

/** knowledge_links is symmetric — a node's edges may have it as source OR target. */
export async function listLinksFor(type: LinkableType, id: string): Promise<LinkEdge[]> {
  const { data, error } = await supabase
    .from('knowledge_links')
    .select('*')
    .or(`and(source_type.eq.${type},source_id.eq.${id}),and(target_type.eq.${type},target_id.eq.${id})`)
  if (error) throw error

  return (data as KnowledgeLink[]).map((link) => {
    const isSource = link.source_type === type && link.source_id === id
    return {
      linkId: link.id,
      otherType: (isSource ? link.target_type : link.source_type) as LinkableType,
      otherId: isSource ? link.target_id : link.source_id,
    }
  })
}

export async function createLink(params: {
  userId: string
  workspaceId: string | null
  sourceType: LinkableType
  sourceId: string
  targetType: LinkableType
  targetId: string
}): Promise<KnowledgeLink> {
  // The unique constraint only covers one direction (source, target) — check
  // both directions here so linking A->B twice, from either side, is a no-op.
  const { data: existing, error: existingError } = await supabase
    .from('knowledge_links')
    .select('*')
    .or(
      `and(source_type.eq.${params.sourceType},source_id.eq.${params.sourceId},target_type.eq.${params.targetType},target_id.eq.${params.targetId}),` +
        `and(source_type.eq.${params.targetType},source_id.eq.${params.targetId},target_type.eq.${params.sourceType},target_id.eq.${params.sourceId})`,
    )
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return existing

  const { data, error } = await supabase
    .from('knowledge_links')
    .insert({
      user_id: params.userId,
      workspace_id: params.workspaceId,
      source_type: params.sourceType,
      source_id: params.sourceId,
      target_type: params.targetType,
      target_id: params.targetId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteLink(linkId: string): Promise<void> {
  const { error } = await supabase.from('knowledge_links').delete().eq('id', linkId)
  if (error) throw error
}
