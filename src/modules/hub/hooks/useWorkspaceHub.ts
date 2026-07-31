import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useCommandContext } from '@/modules/commands/hooks/useCommandContext'
import { buildWorkspaceHubState } from '@/modules/hub/hubData'
import { buildExecutiveSummary } from '@/modules/hub/executiveSummary'

/** UX-13.7 — the one React Query wrapper around buildWorkspaceHubState, used by WorkspaceIntelligenceHubPage; mirrors useDashboardState's shape. Disabled for the "All Workspaces" view (workspaceId === null) — the Hub is a per-workspace command center, same scoping choice WorkspaceEvolutionPage already made. */
export function useWorkspaceHub() {
  const { user } = useAuth()
  const { currentWorkspaceId, workspaces } = useWorkspace()
  const commandContext = useCommandContext()
  const workspaceName = workspaces.find((w) => w.id === currentWorkspaceId)?.name ?? 'This workspace'

  const query = useQuery({
    queryKey: ['workspace-hub', currentWorkspaceId],
    queryFn: () => buildWorkspaceHubState(currentWorkspaceId!, commandContext),
    enabled: Boolean(user) && Boolean(currentWorkspaceId),
  })

  const summary = query.data
    ? buildExecutiveSummary({
        workspaceName,
        maturity: query.data.report.maturity,
        health: query.data.report.health,
        gaps: query.data.gaps,
        recommendations: query.data.recommendations,
      })
    : null

  return { ...query, summary, workspaceName }
}
