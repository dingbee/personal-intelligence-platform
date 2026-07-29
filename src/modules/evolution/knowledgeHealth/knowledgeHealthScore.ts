import type { AiMemory, DocumentRow, KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import { findDuplicateConceptPairs } from '@/modules/knowledge-intelligence/utils/duplicateConceptPairs'
import { daysSince } from '@/modules/evolution/shared/trend'

export type KnowledgeHealthIssueType =
  | 'orphaned_concepts'
  | 'duplicate_concepts'
  | 'stale_documents'
  | 'unread_documents'
  | 'stale_memories'
  | 'inactive_workspace'

export interface KnowledgeHealthIssue {
  type: KnowledgeHealthIssueType
  message: string
  count: number
}

export interface KnowledgeHealthReport {
  score: number
  issues: KnowledgeHealthIssue[]
}

export interface ComputeKnowledgeHealthInput {
  concepts: KnowledgeNode[]
  edges: KnowledgeLink[]
  /** Documents ready to read, with whether reading_progress exists for them. */
  documents: { id: string; status: DocumentRow['status']; updated_at: string; hasReadingProgress: boolean }[]
  memories: AiMemory[]
  workspaceLastActivityAt: string | null
  now?: Date
}

const STALE_DOCUMENT_DAYS = 90
const STALE_MEMORY_DAYS = 90
const INACTIVE_WORKSPACE_DAYS = 60

const ORPHAN_PENALTY_PER_RATIO_POINT = 40
const DUPLICATE_PENALTY_PER_PAIR = 8
const MAX_DUPLICATE_PENALTY = 30
const STALE_DOCUMENT_PENALTY_PER_RATIO_POINT = 20
const UNREAD_DOCUMENT_PENALTY_PER_RATIO_POINT = 10
const STALE_MEMORY_PENALTY_PER_RATIO_POINT = 15
const INACTIVE_WORKSPACE_PENALTY = 15

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/**
 * UX-13 — a single 0-100 "how healthy is this workspace's knowledge"
 * score plus the issues behind it, the same clamp+explanation convention
 * dashboardMetrics.computeIntelligenceScore and healthScore.ts (AI
 * Health) already use. Every count comes from data already fetched
 * elsewhere in the app; orphaned/duplicate concepts reuse the exact same
 * degree/Jaccard logic conceptClusters.ts and duplicateConceptPairs.ts
 * already compute (no new detection). "Disconnected memories" from the
 * brief becomes "stale memories" (active memories untouched for a long
 * time) — ai_memory has no linkage to the knowledge graph in the schema,
 * so genuine graph-disconnection isn't a real signal to detect; staleness
 * by updated_at is the honest substitute.
 */
export function computeKnowledgeHealth(input: ComputeKnowledgeHealthInput): KnowledgeHealthReport {
  const now = input.now ?? new Date()
  const { concepts, edges, documents, memories } = input
  const issues: KnowledgeHealthIssue[] = []
  let score = 100

  const nodeIds = new Set(concepts.map((c) => c.id))
  const degrees = new Map<string, number>(concepts.map((c) => [c.id, 0]))
  for (const edge of edges) {
    if (!edge.generated_by) continue
    if (!nodeIds.has(edge.source_id) || !nodeIds.has(edge.target_id)) continue
    degrees.set(edge.source_id, (degrees.get(edge.source_id) ?? 0) + 1)
    degrees.set(edge.target_id, (degrees.get(edge.target_id) ?? 0) + 1)
  }
  const orphanCount = concepts.filter((c) => (degrees.get(c.id) ?? 0) === 0).length
  if (orphanCount > 0 && concepts.length > 0) {
    const ratio = orphanCount / concepts.length
    score -= ratio * ORPHAN_PENALTY_PER_RATIO_POINT
    issues.push({
      type: 'orphaned_concepts',
      message: `${orphanCount} concept${orphanCount === 1 ? '' : 's'} with no known connections.`,
      count: orphanCount,
    })
  }

  const duplicatePairCount = findDuplicateConceptPairs(concepts, edges).length
  if (duplicatePairCount > 0) {
    score -= Math.min(duplicatePairCount * DUPLICATE_PENALTY_PER_PAIR, MAX_DUPLICATE_PENALTY)
    issues.push({
      type: 'duplicate_concepts',
      message: `${duplicatePairCount} pair${duplicatePairCount === 1 ? '' : 's'} of concepts may be duplicates.`,
      count: duplicatePairCount,
    })
  }

  const readyDocuments = documents.filter((d) => d.status === 'ready')
  const staleDocuments = readyDocuments.filter(
    (d) => !d.hasReadingProgress && daysSince(d.updated_at, now) >= STALE_DOCUMENT_DAYS,
  )
  if (staleDocuments.length > 0 && readyDocuments.length > 0) {
    const ratio = staleDocuments.length / readyDocuments.length
    score -= ratio * STALE_DOCUMENT_PENALTY_PER_RATIO_POINT
    issues.push({
      type: 'stale_documents',
      message: `${staleDocuments.length} document${staleDocuments.length === 1 ? '' : 's'} untouched for ${STALE_DOCUMENT_DAYS}+ days.`,
      count: staleDocuments.length,
    })
  }

  const unreadDocuments = readyDocuments.filter((d) => !d.hasReadingProgress)
  if (unreadDocuments.length > 0 && readyDocuments.length > 0) {
    const ratio = unreadDocuments.length / readyDocuments.length
    score -= ratio * UNREAD_DOCUMENT_PENALTY_PER_RATIO_POINT
    issues.push({
      type: 'unread_documents',
      message: `${unreadDocuments.length} document${unreadDocuments.length === 1 ? '' : 's'} never opened in the Reader.`,
      count: unreadDocuments.length,
    })
  }

  const activeMemories = memories.filter((m) => m.is_active)
  const staleMemories = activeMemories.filter((m) => daysSince(m.updated_at, now) >= STALE_MEMORY_DAYS)
  if (staleMemories.length > 0 && activeMemories.length > 0) {
    const ratio = staleMemories.length / activeMemories.length
    score -= ratio * STALE_MEMORY_PENALTY_PER_RATIO_POINT
    issues.push({
      type: 'stale_memories',
      message: `${staleMemories.length} memor${staleMemories.length === 1 ? 'y' : 'ies'} unchanged for ${STALE_MEMORY_DAYS}+ days.`,
      count: staleMemories.length,
    })
  }

  if (input.workspaceLastActivityAt && daysSince(input.workspaceLastActivityAt, now) >= INACTIVE_WORKSPACE_DAYS) {
    score -= INACTIVE_WORKSPACE_PENALTY
    issues.push({
      type: 'inactive_workspace',
      message: `No activity in this workspace for ${daysSince(input.workspaceLastActivityAt, now)} days.`,
      count: 1,
    })
  }

  return { score: clamp(score), issues }
}
