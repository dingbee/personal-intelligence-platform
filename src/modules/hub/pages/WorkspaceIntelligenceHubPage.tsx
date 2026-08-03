import { Link } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useWorkspaceHub } from '@/modules/hub/hooks/useWorkspaceHub'
import { useGreeting } from '@/modules/greeting/hooks/useGreeting'
import { MaturityBadge } from '@/modules/evolution/components/MaturityBadge'
import { ConceptEvolutionSection } from '@/modules/evolution/components/ConceptEvolutionSection'
import { EvolutionTimelineSection } from '@/modules/evolution/components/EvolutionTimelineSection'
import { RecommendedActionsSection } from '@/modules/intelligence/dashboard/components/RecommendedActionsSection'
import { SignalList } from '@/modules/intelligence/components/SignalList'
import { WorkspaceGapsSection } from '@/modules/hub/components/WorkspaceGapsSection'
import { WorkspaceObjectivesSection } from '@/modules/hub/components/WorkspaceObjectivesSection'
import { RecentNotesSection } from '@/modules/hub/components/RecentNotesSection'
import { ActiveConversationsSection } from '@/modules/hub/components/ActiveConversationsSection'
import { ContinueWorkingCard } from '@/modules/hub/components/ContinueWorkingCard'
import { useCommandContext } from '@/modules/commands/hooks/useCommandContext'
import { useCommandActions } from '@/modules/commands/hooks/useCommandActions'
import { useWorkspaceMemberDirectory } from '@/modules/workspaces/hooks/useWorkspaceMemberDirectory'
import { MemberAvatarStack } from '@/shared/components/collaboration/MemberAvatarStack'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatCard } from '@/shared/components/ui/surface/StatCard'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Spinner } from '@/shared/components/ui/Spinner'

/** A zone eyebrow — the small uppercase label that gives the page's stack of sections a sense of grouping instead of one undifferentiated list. */
function ZoneLabel({ children }: { children: string }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">{children}</p>
}

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
 *
 * UX-15.2 — Personal Intelligence Workspace: the same sections above,
 * regrouped into zones answering "what am I working on / what changed /
 * what deserves attention / what should I continue / what should I learn
 * / what should I organize" (see the phase's discovery doc, finding #4)
 * instead of one flat 12-section stack. The header now uses the same
 * personalized useGreeting() as ExecutiveDashboardPage (finding #7) so
 * the two pages stop disagreeing on voice. Dashboard's and Evolution's
 * own distinct content (intelligence scores, growth analytics, journey,
 * forecast) isn't duplicated here — "Explore Deeper" links out to them
 * instead (finding #1, §5 of the discovery doc).
 */
export function WorkspaceIntelligenceHubPage() {
  const { currentWorkspaceId } = useWorkspace()
  const { data, isLoading, summary, workspaceName } = useWorkspaceHub()
  const greeting = useGreeting()
  const commandContext = useCommandContext()
  const commandActions = useCommandActions()
  const { members, isShared } = useWorkspaceMemberDirectory(currentWorkspaceId)

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader level="page" title={greeting.headline} description={greeting.subtext} />

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

          {/* What am I working on? / What should I continue? */}
          <section className="flex flex-col gap-3">
            <ZoneLabel>Continue Working</ZoneLabel>
            <ContinueWorkingCard inProgressDocument={commandContext.inProgressDocument} />
          </section>

          {/* What deserves attention? */}
          <section className="flex flex-col gap-6">
            <ZoneLabel>Needs Your Attention</ZoneLabel>

            <div className="flex flex-col gap-3">
              <SectionHeader level="section" title="Knowledge Gaps" description="What's missing or being neglected." />
              <WorkspaceGapsSection gaps={data.gaps} />
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader level="section" title="Suggested Next Actions" />
              <RecommendedActionsSection recommendations={data.recommendations} commandContext={commandContext} commandActions={commandActions} />
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader level="section" title="AI Insights" />
              <SignalList signals={data.signals} />
            </div>
          </section>

          {/* What changed recently? */}
          <section className="flex flex-col gap-6">
            <ZoneLabel>Recent Activity</ZoneLabel>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-3">
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
              </div>

              <div className="flex flex-col gap-3">
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
              </div>
            </div>
          </section>

          {/* What should I organize? */}
          <section className="flex flex-col gap-6">
            <ZoneLabel>Organize</ZoneLabel>

            {/* UX-14.5.7 — a lightweight teaser only: the full member roster,
                shared-intelligence stats, and recent activity live at their
                own dedicated destination (/collaboration) so this section
                never grows past "who's here, go there for more." */}
            <div className="flex flex-col gap-2">
              <SectionHeader
                level="section"
                title="Collaboration"
                description={
                  isShared
                    ? `${members.length} member${members.length === 1 ? '' : 's'} in ${workspaceName}.`
                    : `${workspaceName} is personal — invite people to start sharing.`
                }
                action={
                  <Link to="/collaboration" className="text-sm text-[var(--color-accent)] hover:underline">
                    Open Collaboration →
                  </Link>
                }
              />
              {isShared && <MemberAvatarStack members={members} />}
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader level="section" title="Workspace Objectives" description={`What ${workspaceName} is trying to accomplish.`} />
              <WorkspaceObjectivesSection workspaceId={currentWorkspaceId} />
            </div>

            <div className="flex flex-col gap-3">
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
            </div>
          </section>

          {/* What should I learn? */}
          <section className="flex flex-col gap-6">
            <ZoneLabel>Explore Deeper</ZoneLabel>

            <div className="flex flex-col gap-3">
              <SectionHeader level="section" title="Active Concepts" description="Concepts that are new or actively growing." />
              <ConceptEvolutionSection concepts={data.activeConcepts} />
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader level="section" title="Recent Evolution" />
              <EvolutionTimelineSection events={data.report.timeline} />
            </div>

            <SurfaceCard className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--color-ink)]">
                Want intelligence scores, growth analytics, and a longer-range forecast for {workspaceName}?
              </p>
              <div className="flex shrink-0 gap-4 text-sm">
                <Link to="/dashboard" className="text-[var(--color-accent)] hover:underline">
                  Open Dashboard →
                </Link>
                <Link to="/evolution" className="text-[var(--color-accent)] hover:underline">
                  Open Evolution →
                </Link>
              </div>
            </SurfaceCard>
          </section>
        </>
      )}
    </div>
  )
}
