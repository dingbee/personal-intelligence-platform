import { describe, expect, it } from 'vitest'
import { resolveWorkspaceIntelligenceSummaries } from '@/modules/intelligence/dashboard/dashboardResolver'
import type { WorkspaceStats } from '@/modules/workspaces/api/workspaces'

function makeStats(overrides: Partial<WorkspaceStats> = {}): WorkspaceStats {
  return {
    documents: 0,
    collections: 0,
    notes: 0,
    conversations: 0,
    knowledgeNodes: 0,
    highlights: 0,
    flashcards: 0,
    chapterSummaries: 0,
    storageBytes: 0,
    lastActivityAt: null,
    ...overrides,
  }
}

describe('resolveWorkspaceIntelligenceSummaries', () => {
  it('returns an empty array for no workspaces', () => {
    expect(resolveWorkspaceIntelligenceSummaries({ workspaces: [], stats: new Map(), connectionCounts: new Map() })).toEqual([])
  })

  it('resolves document/concept/connection counts and last activity per workspace', () => {
    const summaries = resolveWorkspaceIntelligenceSummaries({
      workspaces: [{ id: 'w1', name: 'Hospitality Research' }],
      stats: new Map([['w1', makeStats({ documents: 24, knowledgeNodes: 184, lastActivityAt: '2026-07-28T00:00:00.000Z' })]]),
      connectionCounts: new Map([['w1', 37]]),
    })
    expect(summaries).toEqual([
      {
        workspaceId: 'w1',
        workspaceName: 'Hospitality Research',
        documentCount: 24,
        conceptCount: 184,
        connectionCount: 37,
        lastActivityAt: '2026-07-28T00:00:00.000Z',
      },
    ])
  })

  it('defaults to zero counts and null activity when stats failed to load for a workspace', () => {
    const summaries = resolveWorkspaceIntelligenceSummaries({
      workspaces: [{ id: 'w1', name: 'Untouched' }],
      stats: new Map(),
      connectionCounts: new Map(),
    })
    expect(summaries).toEqual([
      { workspaceId: 'w1', workspaceName: 'Untouched', documentCount: 0, conceptCount: 0, connectionCount: 0, lastActivityAt: null },
    ])
  })

  it('preserves workspace order and covers every workspace given', () => {
    const summaries = resolveWorkspaceIntelligenceSummaries({
      workspaces: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
      stats: new Map(),
      connectionCounts: new Map(),
    })
    expect(summaries.map((s) => s.workspaceId)).toEqual(['a', 'b', 'c'])
  })

  it('defaults connectionCount to zero when a workspace has no entry in connectionCounts', () => {
    const summaries = resolveWorkspaceIntelligenceSummaries({
      workspaces: [{ id: 'w1', name: 'Research' }],
      stats: new Map([['w1', makeStats({ documents: 5 })]]),
      connectionCounts: new Map(),
    })
    expect(summaries[0]!.connectionCount).toBe(0)
  })

  it('resolves independent summaries for multiple workspaces without cross-contamination', () => {
    const summaries = resolveWorkspaceIntelligenceSummaries({
      workspaces: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      stats: new Map([
        ['a', makeStats({ documents: 10, knowledgeNodes: 5 })],
        ['b', makeStats({ documents: 2, knowledgeNodes: 50 })],
      ]),
      connectionCounts: new Map([['a', 3], ['b', 9]]),
    })
    expect(summaries.find((s) => s.workspaceId === 'a')).toMatchObject({ documentCount: 10, conceptCount: 5, connectionCount: 3 })
    expect(summaries.find((s) => s.workspaceId === 'b')).toMatchObject({ documentCount: 2, conceptCount: 50, connectionCount: 9 })
  })
})
