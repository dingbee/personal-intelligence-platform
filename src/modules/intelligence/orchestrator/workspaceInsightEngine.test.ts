import { describe, expect, it } from 'vitest'
import { computeWorkspaceInsights } from '@/modules/intelligence/orchestrator/workspaceInsightEngine'

describe('computeWorkspaceInsights', () => {
  it('returns nothing for zero workspaces', () => {
    expect(computeWorkspaceInsights({ workspaces: [], recentUploadsCount: 0, recentConversationTitles: [] })).toEqual([])
  })

  it('identifies the most and least active workspace', () => {
    const insights = computeWorkspaceInsights({
      workspaces: [
        { id: 'w1', name: 'Research', documentCount: 5, lastActivityAt: '2026-06-01T00:00:00.000Z' },
        { id: 'w2', name: 'Archive', documentCount: 2, lastActivityAt: '2026-01-01T00:00:00.000Z' },
      ],
      recentUploadsCount: 0,
      recentConversationTitles: [],
    })
    expect(insights).toContainEqual({ type: 'most_active', label: 'Most active workspace', value: 'Research' })
    expect(insights).toContainEqual({ type: 'least_active', label: 'Least active workspace', value: 'Archive' })
  })

  it('omits least_active when there is only one active workspace', () => {
    const insights = computeWorkspaceInsights({
      workspaces: [{ id: 'w1', name: 'Research', documentCount: 5, lastActivityAt: '2026-06-01T00:00:00.000Z' }],
      recentUploadsCount: 0,
      recentConversationTitles: [],
    })
    expect(insights.some((i) => i.type === 'least_active')).toBe(false)
  })

  it('identifies the largest library', () => {
    const insights = computeWorkspaceInsights({
      workspaces: [
        { id: 'w1', name: 'Research', documentCount: 5, lastActivityAt: null },
        { id: 'w2', name: 'Archive', documentCount: 20, lastActivityAt: null },
      ],
      recentUploadsCount: 0,
      recentConversationTitles: [],
    })
    expect(insights).toContainEqual({ type: 'largest_library', label: 'Largest library', value: 'Archive (20 documents)' })
  })

  it('reports recent uploads only when there are some', () => {
    const withUploads = computeWorkspaceInsights({
      workspaces: [{ id: 'w1', name: 'Research', documentCount: 1, lastActivityAt: null }],
      recentUploadsCount: 3,
      recentConversationTitles: [],
    })
    expect(withUploads).toContainEqual({ type: 'recent_uploads', label: 'Recent uploads', value: '3 in the last 7 days' })

    const withoutUploads = computeWorkspaceInsights({
      workspaces: [{ id: 'w1', name: 'Research', documentCount: 1, lastActivityAt: null }],
      recentUploadsCount: 0,
      recentConversationTitles: [],
    })
    expect(withoutUploads.some((i) => i.type === 'recent_uploads')).toBe(false)
  })

  it('identifies the most frequent significant word across conversation titles', () => {
    const insights = computeWorkspaceInsights({
      workspaces: [{ id: 'w1', name: 'Research', documentCount: 1, lastActivityAt: null }],
      recentUploadsCount: 0,
      recentConversationTitles: ['Marketing plan review', 'Marketing budget', 'Product roadmap'],
    })
    expect(insights).toContainEqual({ type: 'most_queried_topic', label: 'Most queried topic', value: 'marketing' })
  })

  it('omits most_queried_topic when nothing repeats', () => {
    const insights = computeWorkspaceInsights({
      workspaces: [{ id: 'w1', name: 'Research', documentCount: 1, lastActivityAt: null }],
      recentUploadsCount: 0,
      recentConversationTitles: ['Marketing plan', 'Product roadmap'],
    })
    expect(insights.some((i) => i.type === 'most_queried_topic')).toBe(false)
  })
})
