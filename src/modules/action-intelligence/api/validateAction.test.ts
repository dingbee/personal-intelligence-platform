import { describe, expect, it } from 'vitest'
import { validateAction } from '@/modules/action-intelligence/api/validateAction'
import type { Action, ActionReadiness } from '@/modules/action-intelligence/action'

function readyState(): ActionReadiness {
  return { state: 'ready', blockers: [], missingInformation: [] }
}

function mkAction(id: string, overrides: Partial<Action> = {}): Action {
  return {
    id,
    title: id,
    description: '',
    type: 'action',
    status: 'proposed',
    priority: 'medium',
    sequence: 1,
    readiness: readyState(),
    dependencies: [],
    actor: { type: 'user', label: 'me' },
    source: { kind: 'user_instruction', label: 'x' },
    expectedOutput: { outcome: '', completionCriteria: null },
    dueHint: null,
    evidenceIds: [],
    ...overrides,
  }
}

describe('validateAction', () => {
  it('produces no issues for a well-formed, consistent action set with objective context', () => {
    const issues = validateAction({ objective: 'Grow', hasUpstreamContext: false, actions: [mkAction('a')], dependencyIssues: [] })
    expect(issues).toEqual([])
  })

  it('merges in dependency-analysis issues (e.g. a circular_dependency) rather than recomputing them', () => {
    const depIssue = { kind: 'circular_dependency' as const, message: 'x', affectedIds: ['a', 'b'] }
    const issues = validateAction({ objective: 'Grow', hasUpstreamContext: false, actions: [mkAction('a')], dependencyIssues: [depIssue] })
    expect(issues).toContainEqual(depIssue)
  })

  it('flags missing_actions when the action list is empty', () => {
    const issues = validateAction({ objective: 'Grow', hasUpstreamContext: false, actions: [], dependencyIssues: [] })
    expect(issues.some((i) => i.kind === 'missing_actions')).toBe(true)
  })

  it('flags missing_objective_or_context when there is no objective and no upstream plan/decision', () => {
    const issues = validateAction({ objective: null, hasUpstreamContext: false, actions: [mkAction('a')], dependencyIssues: [] })
    expect(issues.some((i) => i.kind === 'missing_objective_or_context')).toBe(true)
  })

  it('does not flag missing_objective_or_context when upstream plan/decision context is present, even without an explicit objective', () => {
    const issues = validateAction({ objective: null, hasUpstreamContext: true, actions: [mkAction('a')], dependencyIssues: [] })
    expect(issues.some((i) => i.kind === 'missing_objective_or_context')).toBe(false)
  })

  it('flags a missing responsible actor for action/task/follow_up types', () => {
    const issues = validateAction({ objective: 'Grow', hasUpstreamContext: false, actions: [mkAction('a', { actor: { type: 'unassigned', label: null } })], dependencyIssues: [] })
    expect(issues.some((i) => i.kind === 'missing_actor')).toBe(true)
  })

  it('does not require an actor for an information_request or decision_required action', () => {
    const infoReq = mkAction('a', { type: 'information_request', actor: { type: 'unassigned', label: null }, readiness: { state: 'needs_information', blockers: [], missingInformation: ['x'] } })
    const issues = validateAction({ objective: 'Grow', hasUpstreamContext: false, actions: [infoReq], dependencyIssues: [] })
    expect(issues.some((i) => i.kind === 'missing_actor')).toBe(false)
  })

  it('flags duplicate ids', () => {
    const issues = validateAction({ objective: 'Grow', hasUpstreamContext: false, actions: [mkAction('a'), mkAction('a')], dependencyIssues: [] })
    expect(issues.some((i) => i.kind === 'duplicate_id')).toBe(true)
  })

  it('flags contradictory_readiness when state is ready but blockers/missingInformation are non-empty', () => {
    const contradictory = mkAction('a', { readiness: { state: 'ready', blockers: ['something'], missingInformation: [] } })
    const issues = validateAction({ objective: 'Grow', hasUpstreamContext: false, actions: [contradictory], dependencyIssues: [] })
    expect(issues.some((i) => i.kind === 'contradictory_readiness')).toBe(true)
  })

  it('flags contradictory_readiness when state is non-ready but no blockers/missingInformation explain it', () => {
    const contradictory = mkAction('a', { readiness: { state: 'blocked', blockers: [], missingInformation: [] } })
    const issues = validateAction({ objective: 'Grow', hasUpstreamContext: false, actions: [contradictory], dependencyIssues: [] })
    expect(issues.some((i) => i.kind === 'contradictory_readiness')).toBe(true)
  })

  it('does not flag contradictory_readiness for a properly-explained blocked state', () => {
    const blocked = mkAction('a', { readiness: { state: 'blocked', blockers: ['waiting on X'], missingInformation: [] } })
    const issues = validateAction({ objective: 'Grow', hasUpstreamContext: false, actions: [blocked], dependencyIssues: [] })
    expect(issues.some((i) => i.kind === 'contradictory_readiness')).toBe(false)
  })
})
