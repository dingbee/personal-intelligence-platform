import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/modules/planning-intelligence/module'
import type { Plan } from '@/modules/planning-intelligence/plan'

const { hasFeatureMock, runCapabilityMock, checkQuotaMock, consumeQuotaMock } = vi.hoisted(() => ({
  hasFeatureMock: vi.fn(),
  runCapabilityMock: vi.fn(),
  checkQuotaMock: vi.fn(),
  consumeQuotaMock: vi.fn(),
}))

vi.mock('@/modules/plans/api/plans', () => ({ hasFeature: hasFeatureMock }))
vi.mock('@/modules/ai/orchestration/runCapability', () => ({ runCapability: runCapabilityMock }))
vi.mock('@/shared/lib/quotaService', () => ({ quotaService: { checkQuota: checkQuotaMock, consumeQuota: consumeQuotaMock } }))

import { revisePlanningIntelligence } from '@/modules/planning-intelligence/api/revisePlanningIntelligence'

function jsonResponse(obj: unknown) {
  return { content: JSON.stringify(obj), model: 'test-model' }
}

function originalPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    title: 'Pricing Page Launch Plan',
    objective: 'Launch the pricing page',
    description: null,
    status: 'complete',
    currentState: null,
    desiredOutcome: null,
    gapAnalysis: null,
    assumptions: [],
    constraints: [],
    objectives: [],
    workstreams: [],
    milestones: [{ id: 'm-1', title: 'Design finalized', description: '', target: null, targetDate: '2027-02-01', sequence: 1, dependsOnMilestoneIds: [] }],
    tasks: [
      { id: 't-1', title: 'Draft copy', description: '', status: 'completed', priority: 'high', sequence: 1, dependsOnTaskIds: [], milestoneId: 'm-1', workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
      { id: 't-2', title: 'Implement page', description: '', status: 'in_progress', priority: 'medium', sequence: 2, dependsOnTaskIds: ['t-1'], milestoneId: 'm-1', workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
    ],
    risks: [],
    decisions: [],
    outputs: [],
    successCriteria: [],
    resources: [],
    deadline: '2027-03-01',
    criticalPath: ['t-1', 't-2'],
    contextEvidence: [],
    workspaceId: 'workspace-1',
    createdAt: new Date().toISOString(),
    validationIssues: [],
    revisionOf: null,
    revisionReason: null,
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    ...overrides,
  }
}

describe('revisePlanningIntelligence', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    checkQuotaMock.mockResolvedValue({ allowed: true, used: 0, limit: 1000 })
    consumeQuotaMock.mockResolvedValue(true)
  })

  it('denies a non-entitled user before any AI call', async () => {
    hasFeatureMock.mockResolvedValue(false)
    await expect(revisePlanningIntelligence({ plan: originalPlan(), change: 'Deadline moved up', userId: 'free-user', workspaceId: 'workspace-1', chain: ['anthropic'] })).rejects.toThrow(
      'requires an upgraded plan',
    )
    expect(runCapabilityMock).not.toHaveBeenCalled()
  })

  it('declines an empty change description without calling the AI', async () => {
    hasFeatureMock.mockResolvedValue(true)
    const { plan } = await revisePlanningIntelligence({ plan: originalPlan(), change: '   ', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })
    expect(plan.status).toBe('declined')
    expect(plan.declineReason).toContain('description of what changed')
    expect(runCapabilityMock).not.toHaveBeenCalled()
  })

  it('declines revising a plan that is not itself complete (e.g. already declined/failed)', async () => {
    hasFeatureMock.mockResolvedValue(true)
    const { plan } = await revisePlanningIntelligence({ plan: originalPlan({ status: 'failed' }), change: 'Deadline moved up', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })
    expect(plan.status).toBe('declined')
    expect(plan.declineReason).toContain('Only a completed plan')
    expect(runCapabilityMock).not.toHaveBeenCalled()
  })

  it('preserves an unaffected task\'s real id AND real progress status, while genuinely updating the affected one', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(
      jsonResponse({
        title: 'Pricing Page Launch Plan (revised)',
        milestones: [{ localId: 'm-1', title: 'Design finalized', description: '', target: null, targetDate: '2027-02-01', sequence: 1, dependsOn: [] }],
        tasks: [
          // t-1 unaffected — reused verbatim (real id, was 'completed').
          { localId: 't-1', title: 'Draft copy', description: '', priority: 'high', sequence: 1, dependsOn: [], milestoneId: 'm-1' },
          // t-2 affected by the change — same real id reused (its progress carries forward), but description updated.
          { localId: 't-2', title: 'Implement page', description: 'Now urgent — deadline moved up.', priority: 'high', sequence: 2, dependsOn: ['t-1'], milestoneId: 'm-1' },
        ],
      }),
    )

    const { plan } = await revisePlanningIntelligence({ plan: originalPlan(), change: 'The deadline was moved up to 2027-02-15', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(plan.status).toBe('complete')
    expect(plan.revisionOf).toBe('plan-1')
    expect(plan.revisionReason).toBe('The deadline was moved up to 2027-02-15')
    const t1 = plan.tasks.find((t) => t.id === 't-1')
    const t2 = plan.tasks.find((t) => t.id === 't-2')
    expect(t1).toBeDefined()
    expect(t1!.status).toBe('completed') // preserved, not reset
    expect(t1!.description).toBe('') // genuinely unchanged
    expect(t2).toBeDefined()
    expect(t2!.status).toBe('in_progress') // preserved
    expect(t2!.description).toBe('Now urgent — deadline moved up.') // genuinely updated
  })

  it('flags an impossible state introduced by the revision (validatePlan catches it) rather than hiding it', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(
      jsonResponse({
        title: 'Pricing Page Launch Plan (revised)',
        deadline: '2027-01-01', // now BEFORE the milestone's own targetDate below
        milestones: [{ localId: 'm-1', title: 'Design finalized', description: '', target: null, targetDate: '2027-02-01', sequence: 1, dependsOn: [] }],
        tasks: [{ localId: 't-1', title: 'Draft copy', description: '', priority: 'high', sequence: 1, dependsOn: [], milestoneId: 'm-1' }],
      }),
    )

    const { plan } = await revisePlanningIntelligence({ plan: originalPlan(), change: 'Deadline moved up to 2027-01-01', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(plan.status).toBe('complete') // the plan itself still returns — the issue is surfaced, not hidden
    expect(plan.validationIssues.some((i) => i.kind === 'impossible_deadline')).toBe(true)
  })

  it('recomputes criticalPath for the revised task graph', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(
      jsonResponse({
        title: 'Revised',
        tasks: [
          { localId: 't-1', title: 'Draft copy', description: '', priority: 'high', sequence: 1, dependsOn: [] },
          { localId: 't-2', title: 'Implement page', description: '', priority: 'medium', sequence: 2, dependsOn: ['t-1'] },
        ],
      }),
    )

    const { plan } = await revisePlanningIntelligence({ plan: originalPlan(), change: 'Reorder the work', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })
    expect(plan.criticalPath).toEqual([plan.tasks[0]!.id, plan.tasks[1]!.id])
  })

  it('carries forward an already-resolved decision\'s decisionIntelligence for the SAME decision text, rather than losing it or re-delegating', async () => {
    hasFeatureMock.mockResolvedValue(true)
    const resolvedDecision = {
      id: 'pd-1',
      decision: 'Which pricing tiers to feature',
      options: [],
      recommendation: 'Top tier only — simpler launch.',
      unresolved: true,
      decisionIntelligence: {
        id: 'decision-1',
        title: 'Which tier',
        question: 'Which pricing tiers to feature',
        objective: 'Launch the pricing page',
        status: 'complete' as const,
        alternatives: [],
        criteria: [],
        evaluations: [],
        weightedScores: [],
        recommendedAlternativeId: null,
        confidence: 'medium' as const,
        rationale: 'r',
        tradeoffs: [],
        risks: [],
        assumptions: [],
        constraints: [],
        unknowns: [],
        consequences: [],
        sensitivity: [],
        nextAction: null,
        contextEvidence: [],
        datasetInvestigation: null,
        provisional: false,
        provisionalReason: null,
        validationIssues: [],
        budgetExhausted: false,
        generationFailed: false,
        declineReason: null,
        workspaceId: 'workspace-1',
        createdAt: new Date().toISOString(),
      },
    }
    runCapabilityMock.mockResolvedValue(jsonResponse({ title: 'Revised', decisions: [{ decision: 'Which pricing tiers to feature', options: [], recommendation: null, unresolved: true }] }))

    const { plan } = await revisePlanningIntelligence({
      plan: originalPlan({ decisions: [resolvedDecision] }),
      change: 'Deadline moved up',
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      chain: ['anthropic'],
    })

    expect(plan.decisions[0]!.decisionIntelligence).not.toBeNull()
    expect(plan.decisions[0]!.decisionIntelligence!.id).toBe('decision-1')
  })

  it('never delegates or double-consumes the shared runCapability path for an unrelated decision — only ONE AI call for the revision itself', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(jsonResponse({ title: 'Revised', tasks: [{ localId: 't-1', title: 'Draft copy', description: '', priority: 'high', sequence: 1, dependsOn: [] }] }))

    await revisePlanningIntelligence({ plan: originalPlan(), change: 'Deadline moved up', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(runCapabilityMock).toHaveBeenCalledTimes(1)
    expect(runCapabilityMock.mock.calls[0]![0].capabilityId).toBe('planning-revise-plan')
  })

  it('recovers honestly from malformed revision output instead of fabricating a revised plan', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue({ content: 'not json', model: 'test-model' })

    const { plan } = await revisePlanningIntelligence({ plan: originalPlan(), change: 'Deadline moved up', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(plan.status).toBe('failed')
    expect(plan.generationFailed).toBe(true)
  })
})
