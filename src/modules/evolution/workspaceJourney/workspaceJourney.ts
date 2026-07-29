export type JourneyMilestoneKey =
  | 'workspace_created'
  | 'first_document'
  | 'knowledge_graph_appeared'
  | 'reader_started'
  | 'first_conversation'
  | 'current_state'

export interface JourneyMilestone {
  key: JourneyMilestoneKey
  label: string
  /** Null when this milestone hasn't happened yet — it still appears in the list, unreached. */
  achievedAt: string | null
}

export interface WorkspaceJourneyInput {
  workspaceCreatedAt: string
  firstDocumentAt: string | null
  firstConceptAt: string | null
  firstReadingProgressAt: string | null
  firstConversationAt: string | null
  currentStateLabel: string
  now?: Date
}

/**
 * UX-13 Workspace Journey — a milestone list built entirely from the
 * earliest existing timestamp of each kind (documents.created_at,
 * knowledge_nodes.created_at, reading_progress.updated_at,
 * conversations.created_at). This is genuinely a first-occurrence
 * timeline (unlike documentJourney.ts's UX-9 "current status" snapshot,
 * which only had *current* state to work with) — no event log needed,
 * because "when did the first X happen" is just a MIN() over data that
 * already exists. "Executive Dashboard Used" from the brief's example is
 * omitted: no view/usage event is ever recorded for any page in this app,
 * so there's no real timestamp to report — inventing one would violate
 * the deterministic-evidence requirement.
 */
export function computeWorkspaceJourney(input: WorkspaceJourneyInput): JourneyMilestone[] {
  const now = input.now ?? new Date()
  return [
    { key: 'workspace_created', label: 'Workspace created', achievedAt: input.workspaceCreatedAt },
    { key: 'first_document', label: 'First document added', achievedAt: input.firstDocumentAt },
    { key: 'knowledge_graph_appeared', label: 'Knowledge graph appeared', achievedAt: input.firstConceptAt },
    { key: 'reader_started', label: 'Reader started', achievedAt: input.firstReadingProgressAt },
    { key: 'first_conversation', label: 'First conversation', achievedAt: input.firstConversationAt },
    { key: 'current_state', label: `Current state: ${input.currentStateLabel}`, achievedAt: now.toISOString() },
  ]
}
