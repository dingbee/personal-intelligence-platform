import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { getWorkspaceEvolutionSnapshot } from '@/modules/evolution/api/evolutionData'
import { buildWorkspaceEvolutionReport } from '@/modules/evolution/evolutionReport'
import { buildWorkspaceEvolutionOverview } from '@/modules/evolution/evolutionOverview'

/** UX-13 — the full evolution report for one specific workspace: timeline, concept trends, health, relationships, journey, forecasts. */
export function useWorkspaceEvolutionReport(workspaceId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workspace-evolution', workspaceId],
    queryFn: () => getWorkspaceEvolutionSnapshot(workspaceId!).then(buildWorkspaceEvolutionReport),
    enabled: Boolean(user) && Boolean(workspaceId),
  })
}

/** UX-13 — the "All Workspaces" view: one maturity/health/forecast row per workspace, mirroring dashboardResolver's WorkspaceIntelligenceSummary list. */
export function useWorkspaceEvolutionOverview(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workspace-evolution-overview'],
    queryFn: buildWorkspaceEvolutionOverview,
    enabled: Boolean(user) && enabled,
  })
}
