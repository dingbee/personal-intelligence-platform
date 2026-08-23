import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCommandContext } from '@/modules/commands/hooks/useCommandContext'
import { hasMemoryNeedingReview } from '@/modules/intelligence/orchestrator/signalEngine'
import { generateRecommendations, type Recommendation } from '@/modules/intelligence/recommendations/recommendationEngine'
import { listMemories } from '@/modules/ai/memory/api/memory'
import { listKnowledgeNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { persistProactiveRecommendations } from '@/modules/notifications/api/proactiveRecommendations'

export function useWorkspaceRecommendations(limit = 3): Recommendation[] {
  const commandContext = useCommandContext()
  const workspaceId = commandContext.workspaceId

  const { data: memories = [] } = useQuery({
    queryKey: ['workspace-recommendations-memories', workspaceId],
    queryFn: () => listMemories({ workspaceId }),
    enabled: Boolean(workspaceId),
  })

  const { data: conceptCount = 0 } = useQuery({
    queryKey: ['workspace-recommendations-concept-count', workspaceId],
    queryFn: async () => (await listKnowledgeNodes({ workspaceId })).length,
    enabled: Boolean(workspaceId),
  })

  const recommendations = useMemo(
    () =>
      workspaceId
        ? generateRecommendations({
            scope: 'dashboard',
            commandContext,
            hasGraphContext: conceptCount > 0,
            hasMemoryToReview: hasMemoryNeedingReview(memories),
          }).slice(0, limit)
        : [],
    [workspaceId, commandContext, conceptCount, memories, limit],
  )

  const recommendationKey = recommendations.map((recommendation) => `${recommendation.command.id}:${recommendation.reason}`).join('|')

  useEffect(() => {
    if (!workspaceId || recommendations.length === 0) return
    void persistProactiveRecommendations(recommendations, workspaceId).catch((error) => {
      // Proactive delivery is additive: a notification write failure must
      // never break or delay the existing recommendation surface.
      console.error('persistProactiveRecommendations failed', error)
    })
  }, [workspaceId, recommendationKey])

  return recommendations
}
