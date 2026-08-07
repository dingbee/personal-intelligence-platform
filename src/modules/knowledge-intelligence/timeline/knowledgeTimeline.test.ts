import { describe, expect, it } from 'vitest'
import { groupEvidenceByPeriod } from '@/modules/knowledge-intelligence/timeline/knowledgeTimeline'
import type { EvidenceItem } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'

function makeItem(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return { type: 'note', id: 'n1', label: 'A note', createdAt: '2026-01-15T00:00:00.000Z', ...overrides }
}

describe('groupEvidenceByPeriod', () => {
  it('returns an empty array for no evidence', () => {
    expect(groupEvidenceByPeriod([])).toEqual([])
  })

  it('groups items in the same calendar month together', () => {
    const items = [makeItem({ id: 'a', createdAt: '2026-01-05T00:00:00.000Z' }), makeItem({ id: 'b', createdAt: '2026-01-25T00:00:00.000Z' })]
    const result = groupEvidenceByPeriod(items)
    expect(result).toHaveLength(1)
    expect(result[0]!.items).toHaveLength(2)
  })

  it('separates items in different months into different periods', () => {
    const items = [makeItem({ id: 'a', createdAt: '2026-01-05T00:00:00.000Z' }), makeItem({ id: 'b', createdAt: '2026-03-05T00:00:00.000Z' })]
    const result = groupEvidenceByPeriod(items)
    expect(result).toHaveLength(2)
  })

  it('orders periods earliest first, reading as progression', () => {
    const items = [
      makeItem({ id: 'sep', createdAt: '2026-09-01T00:00:00.000Z' }),
      makeItem({ id: 'jan', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeItem({ id: 'jun', createdAt: '2026-06-01T00:00:00.000Z' }),
    ]
    const result = groupEvidenceByPeriod(items)
    expect(result.map((p) => p.label)).toEqual(['January 2026', 'June 2026', 'September 2026'])
  })

  it('orders items within a period earliest first', () => {
    const items = [makeItem({ id: 'late', createdAt: '2026-01-25T00:00:00.000Z' }), makeItem({ id: 'early', createdAt: '2026-01-02T00:00:00.000Z' })]
    const result = groupEvidenceByPeriod(items)
    expect(result[0]!.items.map((i) => i.id)).toEqual(['early', 'late'])
  })

  it('separates the same month across different years', () => {
    const items = [makeItem({ id: 'y1', createdAt: '2025-01-01T00:00:00.000Z' }), makeItem({ id: 'y2', createdAt: '2026-01-01T00:00:00.000Z' })]
    const result = groupEvidenceByPeriod(items)
    expect(result.map((p) => p.label)).toEqual(['January 2025', 'January 2026'])
  })

  it('produces a sortable key in YYYY-MM form', () => {
    const result = groupEvidenceByPeriod([makeItem({ createdAt: '2026-03-15T00:00:00.000Z' })])
    expect(result[0]!.key).toBe('2026-03')
  })
})
