import { describe, expect, it } from 'vitest'
import { computeWorkspaceJourney } from '@/modules/evolution/workspaceJourney/workspaceJourney'

const NOW = new Date('2026-07-29T00:00:00.000Z')

describe('computeWorkspaceJourney', () => {
  it('always includes exactly six milestones in a fixed order', () => {
    const milestones = computeWorkspaceJourney({
      workspaceCreatedAt: '2026-01-01T00:00:00.000Z',
      firstDocumentAt: null,
      firstConceptAt: null,
      firstReadingProgressAt: null,
      firstConversationAt: null,
      currentStateLabel: 'Active',
      now: NOW,
    })
    expect(milestones.map((m) => m.key)).toEqual([
      'workspace_created',
      'first_document',
      'knowledge_graph_appeared',
      'reader_started',
      'first_conversation',
      'current_state',
    ])
  })

  it('leaves unreached milestones with a null achievedAt', () => {
    const milestones = computeWorkspaceJourney({
      workspaceCreatedAt: '2026-01-01T00:00:00.000Z',
      firstDocumentAt: null,
      firstConceptAt: null,
      firstReadingProgressAt: null,
      firstConversationAt: null,
      currentStateLabel: 'Active',
      now: NOW,
    })
    expect(milestones.find((m) => m.key === 'first_document')!.achievedAt).toBeNull()
  })

  it('reports achieved milestones with their real timestamp', () => {
    const milestones = computeWorkspaceJourney({
      workspaceCreatedAt: '2026-01-01T00:00:00.000Z',
      firstDocumentAt: '2026-01-02T00:00:00.000Z',
      firstConceptAt: null,
      firstReadingProgressAt: null,
      firstConversationAt: null,
      currentStateLabel: 'Active',
      now: NOW,
    })
    expect(milestones.find((m) => m.key === 'first_document')!.achievedAt).toBe('2026-01-02T00:00:00.000Z')
  })

  it('always marks current_state as achieved now, with the given label', () => {
    const milestones = computeWorkspaceJourney({
      workspaceCreatedAt: '2026-01-01T00:00:00.000Z',
      firstDocumentAt: null,
      firstConceptAt: null,
      firstReadingProgressAt: null,
      firstConversationAt: null,
      currentStateLabel: 'Mature',
      now: NOW,
    })
    const current = milestones.find((m) => m.key === 'current_state')!
    expect(current.achievedAt).toBe(NOW.toISOString())
    expect(current.label).toContain('Mature')
  })
})
