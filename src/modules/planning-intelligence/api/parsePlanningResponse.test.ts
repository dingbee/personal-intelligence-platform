import { describe, expect, it } from 'vitest'
import { parsePlanningResponse } from '@/modules/planning-intelligence/api/parsePlanningResponse'

function json(obj: unknown): string {
  return JSON.stringify(obj)
}

describe('parsePlanningResponse', () => {
  it('returns invalid for non-JSON text', () => {
    const result = parsePlanningResponse('not json')
    expect(result.status).toBe('invalid')
  })

  it('returns invalid when the JSON object has no usable title', () => {
    const result = parsePlanningResponse(json({ description: 'no title here' }))
    expect(result.status).toBe('invalid')
  })

  it('returns declined when the model reports the objective unplannable', () => {
    const result = parsePlanningResponse(json({ declined: true, reason: 'Too vague.' }))
    expect(result).toEqual({ status: 'declined', reason: 'Too vague.' })
  })

  it('falls back to a generic decline reason when none is supplied', () => {
    const result = parsePlanningResponse(json({ declined: true }))
    expect(result.status).toBe('declined')
    if (result.status === 'declined') expect(result.reason).toContain('could not be planned')
  })

  it('strips markdown code fences before parsing', () => {
    const result = parsePlanningResponse('```json\n' + json({ title: 'Plan' }) + '\n```')
    expect(result.status).toBe('plan')
  })

  it('parses a minimal valid plan with empty arrays for every optional section', () => {
    const result = parsePlanningResponse(json({ title: 'Minimal Plan' }))
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.title).toBe('Minimal Plan')
    expect(result.plan.milestones).toEqual([])
    expect(result.plan.tasks).toEqual([])
    expect(result.plan.assumptions).toEqual([])
  })

  it('assigns a valid InformationOrigin, defaulting to unknown for a missing/invalid value', () => {
    const result = parsePlanningResponse(json({ title: 'Plan', assumptions: [{ statement: 'A guess', origin: 'not-a-real-origin', confidence: 'high' }] }))
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.assumptions[0]!.origin).toBe('unknown')
  })

  it('drops an assumption with no statement rather than fabricating one', () => {
    const result = parsePlanningResponse(json({ title: 'Plan', assumptions: [{ origin: 'known', confidence: 'high' }, { statement: 'Real one', origin: 'known', confidence: 'high' }] }))
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.assumptions).toHaveLength(1)
    expect(result.plan.assumptions[0]!.statement).toBe('Real one')
  })

  it('drops a constraint with an invalid type or severity rather than guessing one', () => {
    const result = parsePlanningResponse(
      json({
        title: 'Plan',
        constraints: [
          { constraint: 'Bad type', type: 'not-a-type', severity: 'hard', origin: 'known' },
          { constraint: 'Bad severity', type: 'time', severity: 'extreme', origin: 'known' },
          { constraint: 'Valid one', type: 'time', severity: 'soft', origin: 'known' },
        ],
      }),
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.constraints).toHaveLength(1)
    expect(result.plan.constraints[0]!.constraint).toBe('Valid one')
  })

  it('resolves milestone/task dependsOn localId references to real, matching ids', () => {
    const result = parsePlanningResponse(
      json({
        title: 'Plan',
        milestones: [
          { localId: 'm1', title: 'First', description: '', sequence: 1, dependsOn: [] },
          { localId: 'm2', title: 'Second', description: '', sequence: 2, dependsOn: ['m1'] },
        ],
      }),
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    const [m1, m2] = result.plan.milestones
    expect(m2!.dependsOnMilestoneIds).toEqual([m1!.id])
  })

  it('silently drops a dependency referencing a localId that was never defined', () => {
    const result = parsePlanningResponse(json({ title: 'Plan', milestones: [{ localId: 'm1', title: 'Only one', description: '', sequence: 1, dependsOn: ['does-not-exist'] }] }))
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.milestones[0]!.dependsOnMilestoneIds).toEqual([])
  })

  it('drops a self-referential dependency', () => {
    const result = parsePlanningResponse(json({ title: 'Plan', milestones: [{ localId: 'm1', title: 'Self-referencing', description: '', sequence: 1, dependsOn: ['m1'] }] }))
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.milestones[0]!.dependsOnMilestoneIds).toEqual([])
  })

  it('resolves a task milestoneId localId reference to the real generated milestone id', () => {
    const result = parsePlanningResponse(
      json({
        title: 'Plan',
        milestones: [{ localId: 'm1', title: 'Milestone', description: '', sequence: 1, dependsOn: [] }],
        tasks: [{ localId: 't1', title: 'Task', description: '', priority: 'medium', sequence: 1, dependsOn: [], milestoneId: 'm1', estimatedEffort: null, requiredResources: [] }],
      }),
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.tasks[0]!.milestoneId).toBe(result.plan.milestones[0]!.id)
  })

  it('resolves a task milestoneId that references nothing to null rather than fabricating a milestone', () => {
    const result = parsePlanningResponse(json({ title: 'Plan', tasks: [{ localId: 't1', title: 'Task', description: '', priority: 'medium', sequence: 1, dependsOn: [], milestoneId: 'ghost', estimatedEffort: null, requiredResources: [] }] }))
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.tasks[0]!.milestoneId).toBeNull()
  })

  it('every generated task has status not_started', () => {
    const result = parsePlanningResponse(json({ title: 'Plan', tasks: [{ localId: 't1', title: 'Task', description: '', priority: 'medium', sequence: 1, dependsOn: [], milestoneId: null, estimatedEffort: null, requiredResources: [] }] }))
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.tasks[0]!.status).toBe('not_started')
  })

  it('drops a risk with an invalid impact value, but keeps a null probability as a legitimate "no honest basis" value', () => {
    const result = parsePlanningResponse(
      json({
        title: 'Plan',
        risks: [
          { risk: 'Bad impact', probability: 'low', impact: 'catastrophic' },
          { risk: 'No probability known', probability: null, impact: 'high' },
        ],
      }),
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.risks).toHaveLength(1)
    expect(result.plan.risks[0]!.risk).toBe('No probability known')
    expect(result.plan.risks[0]!.probability).toBeNull()
  })

  it('preserves a decision\'s unresolved flag and drops malformed options rather than guessing them', () => {
    const result = parsePlanningResponse(
      json({ title: 'Plan', decisions: [{ decision: 'Pick a tier', options: [{ option: 'Basic' }, { notAnOption: true }], recommendation: null, unresolved: true }] }),
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.decisions[0]!.unresolved).toBe(true)
    expect(result.plan.decisions[0]!.options).toEqual([{ option: 'Basic', tradeoff: null }])
  })

  it('never redacts or fabricates secrets/credential-shaped text — parser has no such notion, it only preserves the model output verbatim in string fields', () => {
    const result = parsePlanningResponse(json({ title: 'Plan', description: 'Contains the word budget but no invented number.' }))
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.description).toBe('Contains the word budget but no invented number.')
  })

  it('sets every generated decision\'s decisionIntelligence to null — a real delegated outcome only ever gets attached by runPlanningIntelligence.ts, never by this parser', () => {
    const result = parsePlanningResponse(json({ title: 'Plan', decisions: [{ decision: 'Pick a tier', options: [], recommendation: null, unresolved: true }] }))
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.decisions[0]!.decisionIntelligence).toBeNull()
  })

  it('parses objectives, defaulting an invalid/missing origin to assumed and dropping a statement-less entry', () => {
    const result = parsePlanningResponse(
      json({ title: 'Plan', objectives: [{ statement: 'Grow revenue', origin: 'known' }, { statement: 'No origin given' }, { origin: 'known' }] }),
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.objectives).toHaveLength(2)
    expect(result.plan.objectives[0]).toMatchObject({ statement: 'Grow revenue', origin: 'known' })
    expect(result.plan.objectives[1]).toMatchObject({ statement: 'No origin given', origin: 'assumed' })
  })

  it('resolves a task workstreamId localId reference to the real generated workstream id, and null for an unresolvable one', () => {
    const result = parsePlanningResponse(
      json({
        title: 'Plan',
        workstreams: [{ localId: 'w1', title: 'Design', description: '' }],
        tasks: [
          { localId: 't1', title: 'In workstream', description: '', priority: 'medium', sequence: 1, dependsOn: [], milestoneId: null, workstreamId: 'w1', estimatedEffort: null, requiredResources: [] },
          { localId: 't2', title: 'Unresolvable', description: '', priority: 'medium', sequence: 2, dependsOn: [], milestoneId: null, workstreamId: 'ghost', estimatedEffort: null, requiredResources: [] },
        ],
      }),
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.tasks[0]!.workstreamId).toBe(result.plan.workstreams[0]!.id)
    expect(result.plan.tasks[1]!.workstreamId).toBeNull()
  })

  it('drops a resource with an invalid kind, and only keeps a positive finite capacity (never a fabricated or non-positive one)', () => {
    const result = parsePlanningResponse(
      json({
        title: 'Plan',
        resources: [
          { localId: 'r1', name: 'Designer', kind: 'person', capacity: 1, unit: 'person', origin: 'known' },
          { localId: 'r2', name: 'Bad kind', kind: 'not-a-kind', capacity: 5 },
          { localId: 'r3', name: 'No honest capacity', kind: 'tool', capacity: null, origin: 'assumed' },
          { localId: 'r4', name: 'Negative capacity dropped', kind: 'budget', capacity: -5 },
        ],
      }),
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.resources).toHaveLength(3)
    expect(result.plan.resources.find((r) => r.name === 'Designer')).toMatchObject({ capacity: 1, unit: 'person', origin: 'known' })
    expect(result.plan.resources.find((r) => r.name === 'No honest capacity')).toMatchObject({ capacity: null })
    expect(result.plan.resources.find((r) => r.name === 'Negative capacity dropped')).toMatchObject({ capacity: null })
  })

  it('resolves task resourceRequirements to real resource ids with a positive amount, dropping an unresolvable or non-positive entry', () => {
    const result = parsePlanningResponse(
      json({
        title: 'Plan',
        resources: [{ localId: 'r1', name: 'Designer', kind: 'person', capacity: 1 }],
        tasks: [
          {
            localId: 't1',
            title: 'Design task',
            description: '',
            priority: 'medium',
            sequence: 1,
            dependsOn: [],
            milestoneId: null,
            estimatedEffort: null,
            requiredResources: [],
            resourceRequirements: [{ resourceId: 'r1', amount: 1 }, { resourceId: 'ghost', amount: 1 }, { resourceId: 'r1', amount: -1 }],
          },
        ],
      }),
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.tasks[0]!.resourceRequirements).toEqual([{ resourceId: result.plan.resources[0]!.id, amount: 1 }])
  })

  it('parses a real ISO plan deadline and milestone targetDate, rejecting an impossible calendar date rather than guessing a repair', () => {
    const result = parsePlanningResponse(
      json({
        title: 'Plan',
        deadline: '2027-03-15',
        milestones: [
          { localId: 'm1', title: 'Real date', description: '', sequence: 1, dependsOn: [], targetDate: '2027-02-01' },
          { localId: 'm2', title: 'Impossible date', description: '', sequence: 2, dependsOn: [], targetDate: '2027-02-30' },
        ],
      }),
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.deadline).toBe('2027-03-15')
    expect(result.plan.milestones[0]!.targetDate).toBe('2027-02-01')
    expect(result.plan.milestones[1]!.targetDate).toBeNull()
  })

  it('leaves deadline/targetDate null when not supplied, rather than fabricating a date', () => {
    const result = parsePlanningResponse(json({ title: 'Plan', milestones: [{ localId: 'm1', title: 'No date', description: '', sequence: 1, dependsOn: [] }] }))
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.deadline).toBeNull()
    expect(result.plan.milestones[0]!.targetDate).toBeNull()
  })

  it('parses a risk contingency distinctly from mitigation', () => {
    const result = parsePlanningResponse(json({ title: 'Plan', risks: [{ risk: 'Design delays', impact: 'medium', mitigation: 'Start early', contingency: 'Bring in a contractor' }] }))
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.risks[0]).toMatchObject({ mitigation: 'Start early', contingency: 'Bring in a contractor' })
  })
})
