import { listWorkspaces } from '@/modules/workspaces/api/workspaces'
import { getWorkspaceEvolutionSnapshot } from '@/modules/evolution/api/evolutionData'
import { buildWorkspaceEvolutionReport } from '@/modules/evolution/evolutionReport'
import type { MaturityStage } from '@/modules/evolution/workspaceEvolution/workspaceMaturity'

export interface WorkspaceEvolutionOverviewEntry {
  workspaceId: string
  workspaceName: string
  maturityStage: MaturityStage
  maturityLabel: string
  healthScore: number
  topForecast: string | null
}

/**
 * UX-13 — "All Workspaces" mode for the Evolution page (WorkspaceEvolutionPage),
 * one row per workspace, the same all-workspace scoping
 * dashboardResolver.resolveWorkspaceIntelligenceSummaries already uses for
 * the Executive Dashboard's Workspace Intelligence section. A full report
 * per workspace is more than this overview needs, but reusing
 * buildWorkspaceEvolutionReport keeps this file free of any duplicated
 * scoring logic; at personal-app scale (a handful of workspaces) the extra
 * fetches are cheap, the same tradeoff dashboardInteraction.ts already
 * accepts for its per-workspace stats.
 */
export async function buildWorkspaceEvolutionOverview(): Promise<WorkspaceEvolutionOverviewEntry[]> {
  const workspaces = await listWorkspaces()
  const entries = await Promise.all(
    workspaces.map(async (workspace) => {
      const snapshot = await getWorkspaceEvolutionSnapshot(workspace.id).catch(() => null)
      if (!snapshot) return null
      const report = buildWorkspaceEvolutionReport(snapshot)
      return {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        maturityStage: report.maturity.stage,
        maturityLabel: report.maturity.label,
        healthScore: report.health.score,
        topForecast: report.forecasts[0]?.message ?? null,
      }
    }),
  )
  return entries.filter((entry): entry is WorkspaceEvolutionOverviewEntry => Boolean(entry))
}
