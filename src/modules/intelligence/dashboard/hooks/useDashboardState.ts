import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useCommandContext } from '@/modules/commands/hooks/useCommandContext'
import { buildDashboardState } from '@/modules/intelligence/dashboard/dashboardInteraction'

/** UX-11 — the one React Query wrapper around buildDashboardState, used by ExecutiveDashboardPage. */
export function useDashboardState() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const commandContext = useCommandContext()

  return useQuery({
    queryKey: ['dashboard-state', currentWorkspaceId],
    queryFn: () => buildDashboardState({ workspaceId: currentWorkspaceId, commandContext }),
    enabled: Boolean(user),
  })
}
