import { describe, expect, it } from 'vitest'
import { buildWorkspaceEvolutionReport, type WorkspaceEvolutionSnapshot } from '@/modules/evolution/evolutionReport'
import type { DocumentRow, KnowledgeNode } from '@/shared/types/database'

const NOW = new Date('2026-07-29T00:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

function concept(id: string, title: string, createdAt: string): KnowledgeNode {
  return {
    id,
    user_id: 'u1',
    workspace_id: 'w1',
    node_type: 'concept',
    title,
    title_normalized: title.toLowerCase(),
    description: null,
    source_type: 'document',
    source_id: 'doc1',
    source_chunk_ids: null,
    generation_metadata: null,
    metadata: null,
    created_at: createdAt,
    updated_at: createdAt,
  }
}

function emptySnapshot(overrides: Partial<WorkspaceEvolutionSnapshot> = {}): WorkspaceEvolutionSnapshot {
  return {
    workspaceId: 'w1',
    workspaceCreatedAt: daysAgo(100),
    documents: [],
    notes: [],
    concepts: [],
    edges: [],
    sourceEvents: [],
    conversations: [],
    memories: [],
    readingProgressTimestamps: [],
    lastActivityAt: null,
    now: NOW,
    ...overrides,
  }
}

describe('buildWorkspaceEvolutionReport', () => {
  it('produces every section for a fully empty workspace without throwing', () => {
    const report = buildWorkspaceEvolutionReport(emptySnapshot())
    expect(report.maturity.stage).toBe('declining')
    expect(report.timeline).toEqual([])
    expect(report.concepts).toEqual([])
    expect(report.health.score).toBe(100)
    expect(report.relationships.allTime).toBe(0)
    expect(report.journey).toHaveLength(6)
    expect(report.forecasts.some((f) => f.message.includes('inactive'))).toBe(true)
    expect(report.trace.workspaceId).toBe('w1')
  })

  it('carries a document through to the journey, timeline, and trace input counts', () => {
    const report = buildWorkspaceEvolutionReport(
      emptySnapshot({
        documents: [{ id: 'd1', title: 'Report', created_at: daysAgo(5), updated_at: daysAgo(1), status: 'ready' as DocumentRow['status'], hasReadingProgress: true }],
        lastActivityAt: daysAgo(1),
      }),
    )
    expect(report.journey.find((m) => m.key === 'first_document')!.achievedAt).toBe(daysAgo(5))
    expect(report.timeline.some((e) => e.type === 'document_added')).toBe(true)
    expect(report.trace.inputs.documentCount).toBe(1)
  })

  it('feeds concepts into both the concept-evolution list and the health score', () => {
    const report = buildWorkspaceEvolutionReport(
      emptySnapshot({
        concepts: [concept('a', 'AI Ethics', daysAgo(1)), concept('b', 'Bias', daysAgo(1))],
        lastActivityAt: daysAgo(1),
      }),
    )
    expect(report.concepts).toHaveLength(2)
    expect(report.health.issues.some((i) => i.type === 'orphaned_concepts' && i.count === 2)).toBe(true)
    expect(report.trace.inputs.conceptCount).toBe(2)
  })

  it('reflects the computed maturity stage in the journey current_state label', () => {
    const report = buildWorkspaceEvolutionReport(
      emptySnapshot({
        workspaceCreatedAt: daysAgo(10),
        documents: Array.from({ length: 5 }, (_, i) => ({
          id: `d${i}`,
          title: `Doc ${i}`,
          created_at: daysAgo(i),
          updated_at: daysAgo(i),
          status: 'ready' as DocumentRow['status'],
          hasReadingProgress: true,
        })),
        lastActivityAt: daysAgo(0),
      }),
    )
    const current = report.journey.find((m) => m.key === 'current_state')!
    expect(current.label).toContain(report.maturity.label)
  })
})
