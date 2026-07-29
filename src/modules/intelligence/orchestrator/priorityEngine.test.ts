import { describe, expect, it } from 'vitest'
import { getPriorityOrder, priorityReason, priorityScore } from '@/modules/intelligence/orchestrator/priorityEngine'

describe('priorityEngine', () => {
  it('orders sources exactly as the brief specifies, highest first', () => {
    const keys = getPriorityOrder().map((entry) => entry.key)
    expect(keys).toEqual(['continuation', 'workspace', 'reading', 'memory', 'graph', 'timeline', 'recentConversations', 'genericWorkspace'])
  })

  it('assigns strictly decreasing scores down the cascade', () => {
    const scores = getPriorityOrder().map((entry) => entry.score)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]!)
    }
  })

  it('gives every source a non-empty reason', () => {
    for (const entry of getPriorityOrder()) expect(entry.reason.length).toBeGreaterThan(0)
  })

  it('priorityScore looks up the same score as getPriorityOrder', () => {
    expect(priorityScore('continuation')).toBe(getPriorityOrder()[0]!.score)
    expect(priorityScore('genericWorkspace')).toBe(getPriorityOrder().at(-1)!.score)
  })

  it('priorityReason looks up the same reason as getPriorityOrder', () => {
    expect(priorityReason('memory')).toBe(getPriorityOrder().find((e) => e.key === 'memory')!.reason)
  })
})
