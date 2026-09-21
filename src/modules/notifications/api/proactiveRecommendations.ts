import { supabase } from '@/shared/lib/supabase'
import type { Recommendation } from '@/modules/intelligence/recommendations/recommendationEngine'

type PersistProactiveRecommendationRpc = {
  (
    fn: 'persist_proactive_recommendation',
    args: {
      p_dedupe_key: string
      p_title: string
      p_reason: string
      p_command_id: string
      p_workspace_id: string | null
    },
  ): ReturnType<typeof supabase.rpc>
}

const persistProactiveRecommendationRpc = supabase.rpc as unknown as PersistProactiveRecommendationRpc

/** Persist the existing recommendation engine's output as an ambient notification.
 * The database RPC owns authentication and deduplication; this client helper
 * never writes directly to notifications.
 */
export async function persistProactiveRecommendations(
  recommendations: Recommendation[],
  workspaceId: string | null,
): Promise<void> {
  if (recommendations.length === 0) return

  await Promise.all(
    recommendations.slice(0, 3).map(async (recommendation) => {
      const commandId = recommendation.command.id
      const dedupeKey = `${workspaceId ?? 'personal'}:${commandId}:${recommendation.reason}`
      const { error } = await persistProactiveRecommendationRpc('persist_proactive_recommendation', {
        p_dedupe_key: dedupeKey,
        p_title: recommendation.command.title,
        p_reason: recommendation.reason,
        p_command_id: commandId,
        p_workspace_id: workspaceId,
      })
      if (error) throw error
    }),
  )
}
