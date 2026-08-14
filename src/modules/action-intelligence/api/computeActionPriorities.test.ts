import { describe, expect, it } from 'vitest'
import { computeActionPriorities } from '@/modules/action-intelligence/api/computeActionPriorities'
import type { ParsedAction } from '@/modules/action-intelligence/api/parseActionResponse'
import type { ActionDependency, ActionPriority } from '@/modules/action-intelligence/action'

function mkAction(id: string, priority: ActionPriority = 'low', overrides: Partial<ParsedAction> = {}): ParsedAction {
  return {
    id,
    title: id,
    description: '',
    type: 'action',
    status: 'proposed',
    priority,
    sequence: 1,
    dependencies: [],
    actor: { type: 'unassigned', label: null },
    expectedOutput: { outcome: '', completionCriteria: null },
    dueHint: null,
    evidenceIds: [],
    ...overrides,
  }
}

function dep(targetId: string): ActionDependency {
  return { id: crypto.randomUUID(), kind: 'action', targetId, description: 'x' }
}

describe('computeActionPriorities', () => {
  it('keeps the explicit priority unchanged when there is no blocking impact or dueHint', () => {
    const a = mkAction('a', 'medium')
    const result = computeActionPriorities([a])
    expect(result.get('a')).toBe('medium')
  })

  it('bumps a blocking action (depended upon by another) up one level', () => {
    const blocker = mkAction('blocker', 'low')
    const dependent = mkAction('dependent', 'low', { dependencies: [dep('blocker')] })
    const result = computeActionPriorities([blocker, dependent])
    expect(result.get('blocker')).toBe('medium')
  })

  it('bumps an action with a genuine dueHint up one level', () => {
    const a = mkAction('a', 'low', { dueHint: 'before the semester starts' })
    const result = computeActionPriorities([a])
    expect(result.get('a')).toBe('medium')
  })

  it('caps the bump at high, never exceeding it', () => {
    const blocker = mkAction('blocker', 'high', { dueHint: 'this week' })
    const dependent = mkAction('dependent', 'low', { dependencies: [dep('blocker')] })
    const result = computeActionPriorities([blocker, dependent])
    expect(result.get('blocker')).toBe('high')
  })

  it('never demotes a priority', () => {
    const a = mkAction('a', 'high')
    const result = computeActionPriorities([a])
    expect(result.get('a')).toBe('high')
  })

  it('does not invent urgency from a missing dueHint', () => {
    const a = mkAction('a', 'low', { dueHint: null })
    const result = computeActionPriorities([a])
    expect(result.get('a')).toBe('low')
  })

  it('applies both bump rules independently (blocking + dueHint stack)', () => {
    const blocker = mkAction('blocker', 'low', { dueHint: 'soon' })
    const dependent = mkAction('dependent', 'low', { dependencies: [dep('blocker')] })
    const result = computeActionPriorities([blocker, dependent])
    expect(result.get('blocker')).toBe('high')
  })
})
