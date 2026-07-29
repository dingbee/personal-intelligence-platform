import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useWorkspaceEvolutionReport, useWorkspaceEvolutionOverview } from '@/modules/evolution/hooks/useWorkspaceEvolution'
import { MaturityBadge } from '@/modules/evolution/components/MaturityBadge'
import { EvolutionTimelineSection } from '@/modules/evolution/components/EvolutionTimelineSection'
import { ConceptEvolutionSection } from '@/modules/evolution/components/ConceptEvolutionSection'
import { KnowledgeHealthSection } from '@/modules/evolution/components/KnowledgeHealthSection'
import { WorkspaceJourneySection } from '@/modules/evolution/components/WorkspaceJourneySection'
import { KnowledgeForecastSection } from '@/modules/evolution/components/KnowledgeForecastSection'
import { WorkspaceEvolutionOverviewTable } from '@/modules/evolution/components/WorkspaceEvolutionOverviewTable'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * UX-13 — the Knowledge Evolution & Workspace Intelligence surface. With
 * a specific workspace selected (WorkspaceSwitcher), shows that
 * workspace's full evolution report; with "All Workspaces" selected,
 * shows the lighter maturity/health overview table instead — the same
 * workspaceId-scoping convention every other data hook in the app already
 * follows (listDocuments({workspaceId}), useDashboardState, etc.).
 */
export function WorkspaceEvolutionPage() {
  const { currentWorkspaceId } = useWorkspace()
  const reportQuery = useWorkspaceEvolutionReport(currentWorkspaceId)
  const overviewQuery = useWorkspaceEvolutionOverview(!currentWorkspaceId)

  const isLoading = currentWorkspaceId ? reportQuery.isLoading : overviewQuery.isLoading

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        level="page"
        title="Knowledge Evolution"
        description="How your knowledge, concepts, and workspaces are changing over time."
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : currentWorkspaceId && reportQuery.data ? (
        <>
          <section className="flex flex-col gap-3">
            <SectionHeader
              level="section"
              title="Workspace Maturity"
              action={<MaturityBadge stage={reportQuery.data.maturity.stage} label={reportQuery.data.maturity.label} />}
              description={reportQuery.data.maturity.reason}
            />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Knowledge Timeline" />
            <EvolutionTimelineSection events={reportQuery.data.timeline} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Concept Growth" />
            <ConceptEvolutionSection concepts={reportQuery.data.concepts} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Knowledge Health" />
            <KnowledgeHealthSection health={reportQuery.data.health} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Workspace Journey" />
            <WorkspaceJourneySection milestones={reportQuery.data.journey} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Forecast" />
            <KnowledgeForecastSection forecasts={reportQuery.data.forecasts} />
          </section>
        </>
      ) : (
        <section className="flex flex-col gap-3">
          <SectionHeader level="section" title="All Workspaces" description="Select a specific workspace to see its full evolution report." />
          <WorkspaceEvolutionOverviewTable entries={overviewQuery.data ?? []} />
        </section>
      )}
    </div>
  )
}
