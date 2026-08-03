import { useQuery } from '@tanstack/react-query'
import { useCommandContext } from '@/modules/commands/hooks/useCommandContext'
import { hasMemoryNeedingReview } from '@/modules/intelligence/orchestrator/signalEngine'
import { generateRecommendations, type Recommendation } from '@/modules/intelligence/recommendations/recommendationEngine'
import { listMemories } from '@/modules/ai/memory/api/memory'
import { listKnowledgeNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'

/**
 * UX-15.3 Phase 4 — the one reusable entry point onto `generateRecommendations`
 * for any surface that isn't Hub or the Dashboard (which already compose
 * their own full fetch — see hubData.ts/dashboardInteraction.ts). Wraps
 * just the two small, workspace-scoped fetches `generateRecommendations`'s
 * `'dashboard'` scope actually needs (memories for `hasMemoryToReview`,
 * knowledge node count for `hasGraphContext`) instead of every caller
 * hand-rolling that gating logic itself — this is what makes Command
 * Palette/Export Center/Knowledge Explorer "consumers of one recommendation
 * service" rather than three more copies of the same fetch-and-gate logic.
 * `informationOrganizationScore` is intentionally omitted here (defaults to
 * 100, never triggering "organize your library") — these three surfaces
 * aren't page-level dashboards; that recommendation already lives on
 * Hub/Dashboard, which do the fuller fetch it needs.
 */
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

  if (!workspaceId) return []

  return generateRecommendations({
    scope: 'dashboard',
    commandContext,
    hasGraphContext: conceptCount > 0,
    hasMemoryToReview: hasMemoryNeedingReview(memories),
  }).slice(0, limit)
}
