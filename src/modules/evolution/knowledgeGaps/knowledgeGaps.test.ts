import { describe, expect, it } from 'vitest'
import { computeKnowledgeGaps } from '@/modules/evolution/knowledgeGaps/knowledgeGaps'
import type { KnowledgeHealthReport } from '@/modules/evolution/knowledgeHealth/knowledgeHealthScore'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'

function health(issues: KnowledgeHealthReport['issues']): KnowledgeHealthReport {
  return { score: 100, issues }
}

describe('computeKnowledgeGaps', () => {
  it('returns no gaps when health has no issues and there is no island signal', () => {
    expect(computeKnowledgeGaps({ health: health([]), signals: [] })).toEqual([])
  })

  it('carries over coverage-related health issues as gaps', () => {
    const issues: KnowledgeHealthReport['issues'] = [
      { type: 'orphaned_concepts', message: '2 concepts with no known connections.', count: 2 },
      { type: 'unread_documents', message: '3 documents never opened in the Reader.', count: 3 },
    ]
    const gaps = computeKnowledgeGaps({ health: health(issues), signals: [] })
    expect(gaps).toEqual(issues)
  })

  it('excludes duplicate_concepts and inactive_workspace — quality/activity issues, not coverage gaps', () => {
    const issues: KnowledgeHealthReport['issues'] = [
      { type: 'duplicate_concepts', message: '1 pair of concepts may be duplicates.', count: 1 },
      { type: 'inactive_workspace', message: 'No activity in this workspace for 90 days.', count: 1 },
    ]
    expect(computeKnowledgeGaps({ health: health(issues), signals: [] })).toEqual([])
  })

  it('adds an isolated_knowledge_island gap from a knowledge_island signal', () => {
    const signals: IntelligenceSignal[] = [{ type: 'knowledge_island', message: '"Topic X" forms an isolated island of 3 concepts.' }]
    const gaps = computeKnowledgeGaps({ health: health([]), signals })
    expect(gaps).toEqual([{ type: 'isolated_knowledge_island', message: signals[0]!.message, count: 1 }])
  })

  it('ignores non-island signals', () => {
    const signals: IntelligenceSignal[] = [{ type: 'emerging_topic', message: '"Topic Y" is gaining new sources quickly.' }]
    expect(computeKnowledgeGaps({ health: health([]), signals })).toEqual([])
  })

  it('combines health-derived gaps and the island signal together', () => {
    const issues: KnowledgeHealthReport['issues'] = [
      { type: 'stale_documents', message: '1 document untouched for 90+ days.', count: 1 },
    ]
    const signals: IntelligenceSignal[] = [{ type: 'knowledge_island', message: 'Isolated island.' }]
    const gaps = computeKnowledgeGaps({ health: health(issues), signals })
    expect(gaps).toHaveLength(2)
    expect(gaps.map((g) => g.type)).toEqual(['stale_documents', 'isolated_knowledge_island'])
  })
})
