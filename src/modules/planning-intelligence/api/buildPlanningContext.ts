import { listWorkspaceObjectives } from '@/modules/hub/api/objectives'
import { gatherEvidence } from '@/modules/research-intelligence/gatherEvidence'
import type { PlanContextSource, PlanContextSourceType } from '@/modules/planning-intelligence/plan'

const MAX_WORKSPACE_OBJECTIVES = 5

export interface PlanningContext {
  objective: string
  userConstraints: string[]
  /** Content of the workspace's own active (not done/dismissed) objectives — real awareness of pre-existing goals, so the planner doesn't propose something that ignores or conflicts with them. Bounded, not a full dump. */
  activeWorkspaceObjectives: string[]
  /** Real, retrieved passages from the user's own documents/notes/analyzed images, relevant to the objective text — reuses Research Intelligence's own gatherEvidence (retrieveContext/retrieveNoteContext/retrieveAssetContext), never a second retrieval mechanism. Already bounded and similarity-ranked by gatherEvidence itself. Carried through to Plan.contextEvidence verbatim (see runPlanningIntelligence.ts), so the provenance adapter has real, id-traceable material rather than a stripped title/excerpt pair. */
  relevantKnowledge: PlanContextSource[]
}

/**
 * Selective context assembly for Planning Intelligence — deliberately
 * NOT a full knowledge-base dump (sprint brief, Phase 3: "Context must
 * be selectively assembled"). Two real sources, both bounded:
 *
 *   1. The workspace's own active objectives (existing
 *      workspace_objectives table) — so the planner is aware of
 *      pre-existing goals rather than operating blind.
 *   2. A single bounded retrieval pass (gatherEvidence) against the
 *      objective text itself, over the user's own documents/notes/
 *      analyzed images — real, cited context, never invented.
 *
 * Explicitly deferred (see final report BACKLOG): deeper integration
 * with prior Research/Analysis investigations, saved conversations, and
 * existing recommendations — none of those are persisted anywhere today
 * (Research/Analysis investigations live for one request only, per
 * runResearchInvestigation.ts/runAnalysisInvestigation.ts's own
 * precedent), so there is nothing real to fetch from them yet without
 * fabricating a source.
 */
export async function buildPlanningContext(params: {
  objective: string
  userConstraints?: string[]
  userId: string
  workspaceId: string | null
}): Promise<PlanningContext> {
  const { objective, userConstraints = [], userId, workspaceId } = params

  const [activeObjectives, evidence] = await Promise.all([
    workspaceId ? listWorkspaceObjectives(workspaceId) : Promise.resolve([]),
    gatherEvidence({ query: objective, userId, workspaceId }),
  ])

  return {
    objective,
    userConstraints,
    activeWorkspaceObjectives: activeObjectives
      .filter((o) => o.status === 'active')
      .slice(0, MAX_WORKSPACE_OBJECTIVES)
      .map((o) => o.content),
    // gatherEvidence's own source types are 'document'|'note'|'asset'|'dataset_investigation' —
    // but 'dataset_investigation' is only ever constructed by Research Intelligence's own
    // orchestration (a delegated Analysis investigation), never by gatherEvidence itself, so a
    // plain gatherEvidence({query, ...}) call like this one can only ever return the first three.
    relevantKnowledge: evidence.map((e) => ({ id: e.id, type: e.source.type as PlanContextSourceType, title: e.source.title, excerpt: e.excerpt })),
  }
}
