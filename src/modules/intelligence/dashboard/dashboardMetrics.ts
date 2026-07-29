export type GrowthMetricType =
  | 'documents_added'
  | 'notes_created'
  | 'concepts_discovered'
  | 'connections_formed'
  | 'questions_asked'
  | 'insights_generated'
  | 'reading_progress_updates'

export interface GrowthMetric {
  type: GrowthMetricType
  label: string
  last7Days: number
  last30Days: number
  allTime: number
}

export interface GrowthMetricsInput {
  documents: { created_at: string }[]
  notes: { created_at: string }[]
  /** knowledge_nodes — already scoped by the caller (dashboardInteraction.ts). */
  concepts: { created_at: string }[]
  /** knowledge_links, pre-filtered to AI-generated (generated_by set) by the caller — never counts user-authored note<->highlight links. */
  connections: { created_at: string }[]
  /** ai_requests rows with feature === 'chat', pre-filtered by the caller. Bounded by when observability logging started (Phase 8A) — "all time" here means "since AI requests began being logged," not literal app-lifetime usage; see dashboardInteraction.ts. */
  chatRequests: { created_at: string }[]
  /** chapter_summaries + flashcards combined by the caller — both are AI-generated artifacts about a document, the closest existing proxy for "insights generated." */
  insightArtifacts: { created_at: string }[]
  readingProgressUpdates: { updated_at: string }[]
  now?: Date
}

function countWindow(timestamps: string[], now: Date, days: number | null): number {
  if (days === null) return timestamps.length
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000
  return timestamps.filter((t) => new Date(t).getTime() >= cutoff).length
}

function buildMetric(type: GrowthMetricType, label: string, timestamps: string[], now: Date): GrowthMetric {
  return {
    type,
    label,
    last7Days: countWindow(timestamps, now, 7),
    last30Days: countWindow(timestamps, now, 30),
    allTime: countWindow(timestamps, now, null),
  }
}

/**
 * UX-11 Phase 3 — Knowledge Growth Analytics. Every count comes from a
 * table that already exists and already has a created_at/updated_at
 * column; nothing here reads from new storage. Comparison windows are
 * computed client-side from already-fetched rows (same technique
 * aiHealthAggregation.ts's calculateHealthTrend already uses for AI
 * request history).
 */
export function computeKnowledgeGrowth(input: GrowthMetricsInput): GrowthMetric[] {
  const now = input.now ?? new Date()
  return [
    buildMetric('documents_added', 'Documents added', input.documents.map((d) => d.created_at), now),
    buildMetric('notes_created', 'Notes created', input.notes.map((n) => n.created_at), now),
    buildMetric('concepts_discovered', 'Concepts discovered', input.concepts.map((c) => c.created_at), now),
    buildMetric('connections_formed', 'Connections formed', input.connections.map((c) => c.created_at), now),
    buildMetric('questions_asked', 'Questions asked', input.chatRequests.map((r) => r.created_at), now),
    buildMetric('insights_generated', 'Insights generated', input.insightArtifacts.map((a) => a.created_at), now),
    buildMetric(
      'reading_progress_updates',
      'Reading sessions',
      input.readingProgressUpdates.map((r) => r.updated_at),
      now,
    ),
  ]
}

export type IntelligenceScoreCategory =
  | 'knowledge_growth'
  | 'memory_quality'
  | 'learning_momentum'
  | 'knowledge_connectivity'
  | 'information_organization'

export type ScoreTrend = 'up' | 'down' | 'stable' | null

export interface IntelligenceScore {
  category: IntelligenceScoreCategory
  label: string
  value: number
  explanation: string
  trend: ScoreTrend
}

export interface IntelligenceScoreInput {
  growth: GrowthMetric[]
  totalMemories: number
  activeMemories: number
  contradictoryMemoryPairCount: number
  /** Concepts belonging to a cluster of size >= 2 (computeConceptClusters, UX-10) — reused, not recomputed. */
  connectedConceptCount: number
  totalConceptCount: number
  /** Documents with a collection assigned or at least one tag. */
  organizedDocumentCount: number
  totalDocumentCount: number
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function findMetric(growth: GrowthMetric[], type: GrowthMetricType): GrowthMetric {
  return growth.find((g) => g.type === type) ?? { type, label: '', last7Days: 0, last30Days: 0, allTime: 0 }
}

/**
 * Compares this week's raw count against the weekly rate implied by the
 * last 30 days — the only trend basis derivable without a persisted score
 * history (no such table exists, and adding one is out of this phase's
 * scope; see the phase report). Null when there's no 30-day baseline to
 * compare against.
 */
function deriveTrend(last7Days: number, last30Days: number): ScoreTrend {
  if (last30Days === 0) return last7Days > 0 ? 'up' : null
  const expectedWeeklyRate = (last30Days / 30) * 7
  if (expectedWeeklyRate === 0) return last7Days > 0 ? 'up' : null
  const ratio = last7Days / expectedWeeklyRate
  if (ratio >= 1.2) return 'up'
  if (ratio <= 0.8) return 'down'
  return 'stable'
}

const GROWTH_CEILING_30D = 30
const CONTRADICTION_PENALTY_PER_PAIR = 15
const MAX_CONTRADICTION_PENALTY = 60
const READING_CEILING_7D = 3

/**
 * UX-11 Phase 2 — Personal Intelligence Index. Not gamification: every
 * value is a normalized function of real, already-fetched counts, and
 * `explanation` always states the literal underlying numbers so the score
 * is traceable back to real data, per the brief. Ceilings (GROWTH_CEILING_30D,
 * READING_CEILING_7D) are fixed, named reference points for "healthy
 * activity at personal scale" — the same house style as healthScore.ts's
 * LATENCY_COMFORTABLE_MS, not tuned per user.
 */
export function computeIntelligenceScore(input: IntelligenceScoreInput): IntelligenceScore[] {
  const docs = findMetric(input.growth, 'documents_added')
  const concepts = findMetric(input.growth, 'concepts_discovered')
  const connections = findMetric(input.growth, 'connections_formed')
  const reading = findMetric(input.growth, 'reading_progress_updates')

  const growth30 = docs.last30Days + concepts.last30Days + connections.last30Days
  const growth7 = docs.last7Days + concepts.last7Days + connections.last7Days

  const scores: IntelligenceScore[] = [
    {
      category: 'knowledge_growth',
      label: 'Knowledge Growth',
      value: clamp((growth30 / GROWTH_CEILING_30D) * 100),
      explanation: `${docs.last30Days} documents, ${concepts.last30Days} concepts, and ${connections.last30Days} connections added in the last 30 days.`,
      trend: deriveTrend(growth7, growth30),
    },
    {
      category: 'memory_quality',
      label: 'Memory Quality',
      value:
        input.totalMemories === 0
          ? 100
          : clamp(
              (input.activeMemories / input.totalMemories) * 100 -
                Math.min(input.contradictoryMemoryPairCount * CONTRADICTION_PENALTY_PER_PAIR, MAX_CONTRADICTION_PENALTY),
            ),
      explanation:
        input.totalMemories === 0
          ? 'No stored memories yet.'
          : `${input.activeMemories} of ${input.totalMemories} memories active; ${input.contradictoryMemoryPairCount} contradiction${input.contradictoryMemoryPairCount === 1 ? '' : 's'} detected.`,
      // No persisted history of memory quality to compare against — see
      // the phase report's Deferred items.
      trend: null,
    },
    {
      category: 'learning_momentum',
      label: 'Learning Momentum',
      value: clamp((reading.last7Days / READING_CEILING_7D) * 100),
      explanation: `Reading activity recorded ${reading.last7Days} time${reading.last7Days === 1 ? '' : 's'} in the last 7 days.`,
      trend: deriveTrend(reading.last7Days, reading.last30Days),
    },
    {
      category: 'knowledge_connectivity',
      label: 'Knowledge Connectivity',
      value:
        input.totalConceptCount === 0
          ? 0
          : clamp((input.connectedConceptCount / input.totalConceptCount) * 100),
      explanation:
        input.totalConceptCount === 0
          ? 'No concepts extracted yet.'
          : `${input.connectedConceptCount} of ${input.totalConceptCount} concepts are connected to at least one other.`,
      trend: null,
    },
    {
      category: 'information_organization',
      label: 'Information Organization',
      value:
        input.totalDocumentCount === 0
          ? 100
          : clamp((input.organizedDocumentCount / input.totalDocumentCount) * 100),
      explanation:
        input.totalDocumentCount === 0
          ? 'No documents yet.'
          : `${input.organizedDocumentCount} of ${input.totalDocumentCount} documents are tagged or organized into a collection.`,
      trend: null,
    },
  ]

  return scores
}
