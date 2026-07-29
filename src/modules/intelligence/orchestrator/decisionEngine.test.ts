import { describe, expect, it } from 'vitest'
import { decideContextSources } from '@/modules/intelligence/orchestrator/decisionEngine'

const NONE = {
  isContinuation: false,
  hasWorkspace: false,
  hasRecentReading: false,
  hasMemory: false,
  hasGraph: false,
  hasTimeline: false,
  hasRecentConversations: false,
}

describe('decideContextSources', () => {
  it('always includes genericWorkspace as the fallback', () => {
    const decisions = decideContextSources(NONE)
    expect(decisions.map((d) => d.key)).toEqual(['genericWorkspace'])
  })

  it('includes only present sources, in priority order', () => {
    const decisions = decideContextSources({
      ...NONE,
      hasGraph: true,
      isContinuation: true,
      hasWorkspace: true,
    })
    expect(decisions.map((d) => d.key)).toEqual(['continuation', 'workspace', 'graph', 'genericWorkspace'])
  })

  it('every decided source is marked present and carries a reason', () => {
    const decisions = decideContextSources({ ...NONE, hasMemory: true })
    for (const decision of decisions) {
      expect(decision.present).toBe(true)
      expect(decision.reason.length).toBeGreaterThan(0)
    }
  })

  it('includes every source when everything is available', () => {
    const decisions = decideContextSources({
      isContinuation: true,
      hasWorkspace: true,
      hasRecentReading: true,
      hasMemory: true,
      hasGraph: true,
      hasTimeline: true,
      hasRecentConversations: true,
    })
    expect(decisions).toHaveLength(8)
  })
})
