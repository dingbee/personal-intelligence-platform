import { describe, expect, it } from 'vitest'
import { analyzeActionDependencies } from '@/modules/action-intelligence/api/analyzeActionDependencies'
import type { ParsedAction } from '@/modules/action-intelligence/api/parseActionResponse'
import type { ActionDependency } from '@/modules/action-intelligence/action'

function mkAction(id: string, title: string, dependencies: ActionDependency[] = []): ParsedAction {
  return {
    id,
    title,
    description: '',
    type: 'action',
    status: 'proposed',
    priority: 'medium',
    sequence: 1,
    dependencies,
    actor: { type: 'unassigned', label: null },
    expectedOutput: { outcome: '', completionCriteria: null },
    dueHint: null,
    evidenceIds: [],
  }
}

function dep(kind: ActionDependency['kind'], targetId: string | null, description = 'x'): ActionDependency {
  return { id: crypto.randomUUID(), kind, targetId, description }
}

describe('analyzeActionDependencies', () => {
  it('produces no issues and a valid processing order for a linear chain', () => {
    const c = mkAction('c', 'C', [dep('action', 'b')])
    const b = mkAction('b', 'B', [dep('action', 'a')])
    const a = mkAction('a', 'A')
    const result = analyzeActionDependencies([c, b, a])
    expect(result.issues).toEqual([])
    expect(result.cyclicActionIds.size).toBe(0)
    const order = result.processingOrder
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
  })

  it('handles a branching graph (two actions depending on the same prerequisite)', () => {
    const root = mkAction('root', 'Root')
    const left = mkAction('left', 'Left', [dep('action', 'root')])
    const right = mkAction('right', 'Right', [dep('action', 'root')])
    const result = analyzeActionDependencies([root, left, right])
    expect(result.issues).toEqual([])
    const order = result.processingOrder
    expect(order.indexOf('root')).toBeLessThan(order.indexOf('left'))
    expect(order.indexOf('root')).toBeLessThan(order.indexOf('right'))
  })

  it('detects a circular dependency and marks all participating actions cyclic', () => {
    const a = mkAction('a', 'A', [dep('action', 'b')])
    const b = mkAction('b', 'B', [dep('action', 'a')])
    const result = analyzeActionDependencies([a, b])
    expect(result.cyclicActionIds.has('a')).toBe(true)
    expect(result.cyclicActionIds.has('b')).toBe(true)
    expect(result.issues.some((i) => i.kind === 'circular_dependency')).toBe(true)
  })

  it('flags a dangling action dependency (targetId not present in the set)', () => {
    const a = mkAction('a', 'A', [dep('action', 'ghost')])
    const result = analyzeActionDependencies([a])
    expect(result.issues.some((i) => i.kind === 'dangling_action_dependency')).toBe(true)
  })

  it('flags a dangling objective dependency (null targetId)', () => {
    const a = mkAction('a', 'A', [dep('objective', null)])
    const result = analyzeActionDependencies([a])
    expect(result.issues.some((i) => i.kind === 'dangling_objective_dependency')).toBe(true)
  })

  it('does not treat a decision-kind dependency as part of the action graph', () => {
    const a = mkAction('a', 'A', [dep('decision', null, 'unresolved pricing')])
    const result = analyzeActionDependencies([a])
    expect(result.issues).toEqual([])
    expect(result.processingOrder).toEqual(['a'])
  })

  it('appends every cyclic action at the end of the processing order', () => {
    const a = mkAction('a', 'A', [dep('action', 'b')])
    const b = mkAction('b', 'B', [dep('action', 'a')])
    const c = mkAction('c', 'C')
    const result = analyzeActionDependencies([a, b, c])
    const order = result.processingOrder
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('a'))
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('b'))
  })
})
