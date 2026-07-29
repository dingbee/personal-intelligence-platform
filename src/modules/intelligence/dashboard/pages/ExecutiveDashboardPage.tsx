import { useGreeting } from '@/modules/greeting/hooks/useGreeting'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useCommandContext } from '@/modules/commands/hooks/useCommandContext'
import { useCommandActions } from '@/modules/commands/hooks/useCommandActions'
import { useDashboardState } from '@/modules/intelligence/dashboard/hooks/useDashboardState'
import { IntelligenceScoreSection } from '@/modules/intelligence/dashboard/components/IntelligenceScoreSection'
import { GrowthAnalyticsSection } from '@/modules/intelligence/dashboard/components/GrowthAnalyticsSection'
import { AttentionCenterSection } from '@/modules/intelligence/dashboard/components/AttentionCenterSection'
import { ExecutiveInsightsSection } from '@/modules/intelligence/dashboard/components/ExecutiveInsightsSection'
import { RecommendedActionsSection } from '@/modules/intelligence/dashboard/components/RecommendedActionsSection'
import { WorkspaceIntelligenceSection } from '@/modules/intelligence/dashboard/components/WorkspaceIntelligenceSection'
import { PersonalIntelligenceTimeline } from '@/modules/intelligence/components/PersonalIntelligenceTimeline'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * UX-11 Phase 7 — the Executive Intelligence Dashboard. Every section is a
 * thin presentational wrapper over dashboardInteraction.ts's already-
 * composed DashboardState; no section fetches its own data beyond what
 * useDashboardState/PersonalIntelligenceTimeline already provide. Reuses
 * SurfaceCard/StatCard/SectionHeader/StatusBadge/AttentionList throughout —
 * no new design language.
 */
export function ExecutiveDashboardPage() {
  const greeting = useGreeting()
  const { currentWorkspaceId } = useWorkspace()
  const commandContext = useCommandContext()
  const commandActions = useCommandActions()
  const { data, isLoading } = useDashboardState()

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader level="page" title={greeting.headline} description={greeting.subtext} />

      {isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Your Intelligence Overview" />
            <IntelligenceScoreSection scores={data.scores} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Attention Required" />
            <AttentionCenterSection items={data.attention} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Knowledge Growth" description="Documents, concepts, connections, and activity over time." />
            <GrowthAnalyticsSection growth={data.growth} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Executive Insights" />
            <ExecutiveInsightsSection insights={data.insights} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Knowledge Evolution" />
            <PersonalIntelligenceTimeline workspaceId={currentWorkspaceId} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Recommended Actions" />
            <RecommendedActionsSection
              recommendations={data.recommendations}
              commandContext={commandContext}
              commandActions={commandActions}
            />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Workspace Intelligence" />
            <WorkspaceIntelligenceSection summaries={data.workspaceSummaries} />
          </section>
        </>
      )}
    </div>
  )
}
