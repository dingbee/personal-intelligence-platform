import { supabase } from '@/shared/lib/supabase'

/**
 * AI Experience Intelligence v1 — the one persistence layer this phase adds.
 * item_key is caller-derived (IntelligenceItem.id for a Hub zone item,
 * `${category}:${command.id}` for a Recommendation — see useDismissedSuggestions
 * consumers) and workspace-scoped, matching how both existing item shapes
 * are themselves computed per-workspace.
 */
export async function listDismissedItemKeys(workspaceId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('dismissed_suggestions').select('item_key').eq('workspace_id', workspaceId)
  if (error) throw error
  return new Set(data.map((row) => row.item_key))
}

export async function dismissItem(params: { workspaceId: string; userId: string; itemKey: string }): Promise<void> {
  const { error } = await supabase
    .from('dismissed_suggestions')
    .upsert(
      { workspace_id: params.workspaceId, user_id: params.userId, item_key: params.itemKey },
      { onConflict: 'user_id,workspace_id,item_key', ignoreDuplicates: true },
    )
  if (error) throw error
}
