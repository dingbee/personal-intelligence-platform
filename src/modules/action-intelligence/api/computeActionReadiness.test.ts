import { describe, expect, it } from 'vitest'
import { computeActionReadiness } from '@/modules/action-intelligence/api/computeActionReadiness'
import { analyzeActionDependencies } from '@/modules/action-intelligence/api/analyzeActionDependencies'
import type { ParsedAction } from '@/modules/action-intelligence/api/parseActionResponse'
import type { ActionDependency } from '@/modules/action-intelligence/action'

function mkAction(id: string, overrides: Partial<ParsedAction> = {}): ParsedAction {
  return {
    id,
    title: id,
    description: '',
    type: 'action',
    status: 'proposed',
    priority: 'medium',
    sequence: 1,
    dependencies: [],
    actor: { type: 'user', label: 'me' },
    expectedOutput: { outcome: '', completionCriteria: null },
    dueHint: null,
    evidenceIds: [],
    ...overrides,
  }
}

function dep(kind: ActionDependency['kind'], targetId: string | null, description = 'x'): ActionDependency {
  return { id: crypto.randomUUID(), kind, targetId, description }
}

describe('computeActionReadiness', () => {
  it('marks an action with a real actor and no blockers as ready', () => {
    const a = mkAction('a')
    const analysis = analyzeActionDependencies([a])
    const readiness = computeActionReadiness([a], analysis)
    expect(readiness.get('a')).toEqual({ state: 'ready', blockers: [], missingInformation: [] })
  })

  it('never trusts a model-declared readiness — it is computed purely from actor/dependency facts', () => {
    // ParsedAction has no `readiness` field at all (enforced at the type level by Omit<Action, 'readiness'|'source'>),
    // so this test documents that computeActionReadiness ignores anything beyond actor + dependencies.
    const a = mkAction('a', { actor: { type: 'user', label: 'me' } })
    const readiness = computeActionReadiness([a], analyzeActionDependencies([a]))
    expect(readiness.get('a')!.state).toBe('ready')
  })

  it('marks an action blocked by an unresolved decision as needs_decision, never ready', () => {
    const a = mkAction('a', { dependencies: [dep('decision', null, 'Finalize pricing')] })
    const readiness = computeActionReadiness([a], analyzeActionDependencies([a]))
    expect(readiness.get('a')!.state).toBe('needs_decision')
    expect(readiness.get('a')!.blockers[0]).toContain('Finalize pricing')
  })

  it('marks an action with an unassigned actor as needs_information', () => {
    const a = mkAction('a', { actor: { type: 'unassigned', label: null } })
    const readiness = computeActionReadiness([a], analyzeActionDependencies([a]))
    expect(readiness.get('a')!.state).toBe('needs_information')
    expect(readiness.get('a')!.missingInformation).toEqual(['No responsible actor identified'])
  })

  it('the worked example: "Send revised proposal" blocked by unresolved "Finalize pricing" is never ready', () => {
    const send = mkAction('send', { title: 'Send revised proposal to client', dependencies: [dep('decision', null, 'Finalize pricing')] })
    const readiness = computeActionReadiness([send], analyzeActionDependencies([send]))
    expect(readiness.get('send')!.state).not.toBe('ready')
    expect(readiness.get('send')!.state).toBe('needs_decision')
  })

  it('information_request type is always needs_information regardless of actor', () => {
    const a = mkAction('a', { type: 'information_request', actor: { type: 'user', label: 'me' } })
    const readiness = computeActionReadiness([a], analyzeActionDependencies([a]))
    expect(readiness.get('a')!.state).toBe('needs_information')
  })

  it('decision_required type is always needs_decision regardless of actor', () => {
    const a = mkAction('a', { type: 'decision_required', actor: { type: 'user', label: 'me' } })
    const readiness = computeActionReadiness([a], analyzeActionDependencies([a]))
    expect(readiness.get('a')!.state).toBe('needs_decision')
  })

  it('an action whose action-dependency is not yet ready becomes blocked', () => {
    const upstream = mkAction('upstream', { actor: { type: 'unassigned', label: null } })
    const downstream = mkAction('downstream', { dependencies: [dep('action', 'upstream')] })
    const analysis = analyzeActionDependencies([upstream, downstream])
    const readiness = computeActionReadiness([upstream, downstream], analysis)
    expect(readiness.get('downstream')!.state).toBe('blocked')
  })

  it('an action with one ready and one not-ready action-dependency is partially_ready', () => {
    const readyDep = mkAction('readyDep')
    const blockedDep = mkAction('blockedDep', { actor: { type: 'unassigned', label: null } })
    const downstream = mkAction('downstream', { dependencies: [dep('action', 'readyDep'), dep('action', 'blockedDep')] })
    const analysis = analyzeActionDependencies([readyDep, blockedDep, downstream])
    const readiness = computeActionReadiness([readyDep, blockedDep, downstream], analysis)
    expect(readiness.get('downstream')!.state).toBe('partially_ready')
  })

  it('a cyclic action is conservatively blocked, never ready', () => {
    const a = mkAction('a', { dependencies: [dep('action', 'b')] })
    const b = mkAction('b', { dependencies: [dep('action', 'a')] })
    const analysis = analyzeActionDependencies([a, b])
    const readiness = computeActionReadiness([a, b], analysis)
    expect(readiness.get('a')!.state).toBe('blocked')
    expect(readiness.get('b')!.state).toBe('blocked')
  })

  it('an objective-kind dependency is informational only and never blocks readiness', () => {
    const a = mkAction('a', { dependencies: [dep('objective', 'obj-1', 'supports growth')] })
    const readiness = computeActionReadiness([a], analyzeActionDependencies([a]))
    expect(readiness.get('a')!.state).toBe('ready')
  })
})
