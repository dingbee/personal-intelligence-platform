import { Link } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useWorkspaceHub } from '@/modules/hub/hooks/useWorkspaceHub'
import { MaturityBadge } from '@/modules/evolution/components/MaturityBadge'
import { ConceptEvolutionSection } from '@/modules/evolution/components/ConceptEvolutionSection'
import { EvolutionTimelineSection } from '@/modules/evolution/components/EvolutionTimelineSection'
import { RecommendedActionsSection } from '@/modules/intelligence/dashboard/components/RecommendedActionsSection'
import { SignalList } from '@/modules/intelligence/components/SignalList'
import { WorkspaceGapsSection } from '@/modules/hub/components/WorkspaceGapsSection'
import { WorkspaceObjectivesSection } from '@/modules/hub/components/WorkspaceObjectivesSection'
import { RecentNotesSection } from '@/modules/hub/components/RecentNotesSection'
import { ActiveConversationsSection } from '@/modules/hub/components/ActiveConversationsSection'
import { CollaborationSection } from '@/modules/hub/components/CollaborationSection'
import { useCommandContext } from '@/modules/commands/hooks/useCommandContext'
import { useCommandActions } from '@/modules/commands/hooks/useCommandActions'
import { useWorkspaceMemberDirectory } from '@/modules/workspaces/hooks/useWorkspaceMemberDirectory'
import { useWorkspaceStats } from '@/modules/workspaces/hooks/useWorkspaceStats'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatCard } from '@/shared/components/ui/surface/StatCard'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * UX-13.7 — the Workspace Intelligence Hub: one per-workspace command
 * center. Deliberately a curated composition, not a re-skin of
 * /evolution or /dashboard — every section here reuses an existing
 * evolution/dashboard component or computation (MaturityBadge,
 * ConceptEvolutionSection, EvolutionTimelineSection,
 * RecommendedActionsSection, SignalList), with three genuinely new
 * pieces: computeKnowledgeGaps, buildExecutiveSummary, and the workspace
 * objectives checklist. See useWorkspaceHub/hubData.ts for the data
 * layer.
 *
 * UX-13.7.3 — Recent Notes and Active Conversations close the "recent
 * work" gap the original pass left out, and HomeRedirect now makes this
 * page the app's homepage once a workspace is selected ("Workspace →
 * Hub" instead of "Workspace → Documents") — see src/app/HomeRedirect.tsx.
 */
export function WorkspaceIntelligenceHubPage() {
  const { currentWorkspaceId } = useWorkspace()
  const { data, isLoading, summary, workspaceName } = useWorkspaceHub()
  const commandContext = useCommandContext()
  const commandActions = useCommandActions()
  const { members, isShared, lookup } = useWorkspaceMemberDirectory(currentWorkspaceId)
  const { data: stats } = useWorkspaceStats(currentWorkspaceId)

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader level="page" title="Workspace Intelligence Hub" description="Your command center for this workspace." />

      {!currentWorkspaceId ? (
        <EmptyState
          title="Select a workspace"
          description="The Hub is a per-workspace command center — pick a workspace from the switcher above, or create one if you don't have one yet."
          action={
            <Link to="/settings/workspaces" className="text-sm text-[var(--color-accent)] hover:underline">
              Manage workspaces →
            </Link>
          }
        />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : !data ? null : (
        <>
          <SurfaceCard className="flex flex-col gap-2">
            <SectionHeader level="section" title="Executive Summary" action={<MaturityBadge stage={data.report.maturity.stage} label={data.report.maturity.label} />} />
            <p className="text-sm text-[var(--color-ink)]">{summary}</p>
          </SurfaceCard>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Knowledge Health" value={data.report.health.score} />
            <StatCard label="Active Concepts" value={data.activeConcepts.length} />
            <StatCard label="Reading Progress" value={`${data.readDocumentCount} / ${data.totalReadyDocumentCount}`} />
            <StatCard label="Document Relationships" value={data.documentRelationshipCount} />
          </div>

          {isShared && stats && (
            <section className="flex flex-col gap-3">
              <SectionHeader level="section" title="Collaboration" description={`Who has access to ${workspaceName} and what's shared.`} />
              <CollaborationSection
                members={members}
                lookup={lookup}
                documentCount={stats.documents}
                noteCount={stats.notes}
                collectionCount={stats.collections}
                recentNotes={data.recentNotes}
                activeConversations={data.activeConversations}
              />
            </section>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section className="flex flex-col gap-3">
              <SectionHeader
                level="section"
                title="Recent Notes"
                action={
                  <Link to="/notes" className="text-sm text-[var(--color-accent)] hover:underline">
                    All notes →
                  </Link>
                }
              />
              <RecentNotesSection notes={data.recentNotes} />
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeader
                level="section"
                title="Active Conversations"
                action={
                  <Link to="/chat" className="text-sm text-[var(--color-accent)] hover:underline">
                    All conversations →
                  </Link>
                }
              />
              <ActiveConversationsSection conversations={data.activeConversations} />
            </section>
          </div>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Active Concepts" description="Concepts that are new or actively growing." />
            <ConceptEvolutionSection concepts={data.activeConcepts} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Knowledge Gaps" description="What's missing or being neglected." />
            <WorkspaceGapsSection gaps={data.gaps} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader
              level="section"
              title="Document Relationships"
              description={`${data.documentRelationshipCount} connection${data.documentRelationshipCount === 1 ? '' : 's'} across this workspace's knowledge graph.`}
              action={
                <Link to="/knowledge/graph" className="text-sm text-[var(--color-accent)] hover:underline">
                  View graph →
                </Link>
              }
            />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="AI Insights" />
            <SignalList signals={data.signals} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Recent Evolution" />
            <EvolutionTimelineSection events={data.report.timeline} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Suggested Next Actions" />
            <RecommendedActionsSection recommendations={data.recommendations} commandContext={commandContext} commandActions={commandActions} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Workspace Objectives" description={`What ${workspaceName} is trying to accomplish.`} />
            <WorkspaceObjectivesSection workspaceId={currentWorkspaceId} />
          </section>
        </>
      )}
    </div>
  )
}
