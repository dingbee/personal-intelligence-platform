import type { Cluster } from '@/modules/knowledge/intelligence/conceptClusters'
import { daysSince } from '@/modules/evolution/shared/trend'

export type EvolutionEventType = 'document_added' | 'note_added' | 'concept_emerged' | 'cluster_evolved'

export interface EvolutionEvent {
  type: EvolutionEventType
  /** ISO timestamp this event is anchored to — for cluster_evolved, the cluster's most recent node timestamp. */
  date: string
  description: string
}

export interface KnowledgeTimelineInput {
  documents: { id: string; title: string; created_at: string }[]
  notes: { id: string; title: string; created_at: string }[]
  /** All knowledge_nodes in scope, keyed for cluster lookups below. */
  concepts: { id: string; title: string; created_at: string }[]
  /** computeConceptClusters' output over the same concepts/edges — reused, never recomputed. */
  clusters: Cluster[]
  now?: Date
}

/** A cluster spanning at least this many days between its earliest and latest concept is described as "evolved over time" rather than "appeared." */
const EVOLUTION_SPAN_MIN_DAYS = 3
/** Below this size a connected component reads as a single emerging concept, not a storyline worth its own timeline entry. */
const CLUSTER_MIN_SIZE_FOR_TIMELINE = 2

function describeDuration(days: number): string {
  if (days >= 60) return `${Math.round(days / 30)} months`
  if (days >= 14) return `${Math.round(days / 7)} weeks`
  return `${days} days`
}

/**
 * UX-13 Knowledge Timeline — turns raw creation timestamps (documents,
 * notes, concepts) plus UX-10's already-computed cluster topology into a
 * chronological list of "what happened" events. The headline capability
 * from the brief — "Marketing strategy evolved over 6 months" instead of
 * "Documents added" — comes from a cluster whose member concepts span a
 * wide creation-date range: the cluster's label plus that span becomes one
 * cluster_evolved event, rather than one flat event per concept. This is
 * still derived entirely from existing timestamps; there is no persisted
 * mutation log (see PersonalIntelligenceTimeline's UX-10 Phase 11 note),
 * so a cluster that lost members over time can't be distinguished from one
 * that only ever grew — every event here describes growth/appearance, not
 * removal.
 */
export function buildKnowledgeTimeline(input: KnowledgeTimelineInput): EvolutionEvent[] {
  const now = input.now ?? new Date()
  const events: EvolutionEvent[] = []

  for (const doc of input.documents) {
    events.push({ type: 'document_added', date: doc.created_at, description: `Added document "${doc.title}".` })
  }
  for (const note of input.notes) {
    events.push({ type: 'note_added', date: note.created_at, description: `Created note "${note.title || 'Untitled note'}".` })
  }

  const conceptsById = new Map(input.concepts.map((c) => [c.id, c]))
  const clusteredConceptIds = new Set<string>()

  for (const cluster of input.clusters) {
    if (cluster.size < CLUSTER_MIN_SIZE_FOR_TIMELINE) continue
    const members = cluster.nodeIds.map((id) => conceptsById.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c))
    if (members.length === 0) continue
    for (const member of members) clusteredConceptIds.add(member.id)

    const timestamps = members.map((m) => new Date(m.created_at).getTime())
    const earliest = new Date(Math.min(...timestamps))
    const latest = new Date(Math.max(...timestamps))
    const spanDays = daysSince(earliest.toISOString(), latest)

    const description =
      spanDays >= EVOLUTION_SPAN_MIN_DAYS
        ? `"${cluster.label}" evolved over ${describeDuration(spanDays)} (${cluster.size} connected concepts).`
        : `"${cluster.label}" emerged as a cluster of ${cluster.size} connected concepts.`

    events.push({ type: 'cluster_evolved', date: latest.toISOString(), description })
  }

  for (const concept of input.concepts) {
    if (clusteredConceptIds.has(concept.id)) continue
    events.push({ type: 'concept_emerged', date: concept.created_at, description: `"${concept.title}" appeared as a new concept.` })
  }

  return events
    .filter((event) => new Date(event.date).getTime() <= now.getTime())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
