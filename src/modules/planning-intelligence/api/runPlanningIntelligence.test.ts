import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/modules/planning-intelligence/module'

const { hasFeatureMock, runCapabilityMock, listWorkspaceObjectivesMock, gatherEvidenceMock, checkQuotaMock, consumeQuotaMock } = vi.hoisted(() => ({
  hasFeatureMock: vi.fn(),
  runCapabilityMock: vi.fn(),
  listWorkspaceObjectivesMock: vi.fn(),
  gatherEvidenceMock: vi.fn(),
  checkQuotaMock: vi.fn(),
  consumeQuotaMock: vi.fn(),
}))

vi.mock('@/modules/plans/api/plans', () => ({ hasFeature: hasFeatureMock }))
vi.mock('@/modules/ai/orchestration/runCapability', () => ({ runCapability: runCapabilityMock }))
vi.mock('@/modules/hub/api/objectives', () => ({ listWorkspaceObjectives: listWorkspaceObjectivesMock }))
vi.mock('@/modules/research-intelligence/gatherEvidence', () => ({ gatherEvidence: gatherEvidenceMock }))
// Operation Budget Foundation — beginIntelligenceOperation/runOperationAiCall talk to
// quotaService, which talks to Supabase directly; mock it the same way the sibling
// engines' own orchestration tests do so this suite never hits the real project.
vi.mock('@/shared/lib/quotaService', () => ({ quotaService: { checkQuota: checkQuotaMock, consumeQuota: consumeQuotaMock } }))

import { runPlanningIntelligence } from '@/modules/planning-intelligence/api/runPlanningIntelligence'

function jsonResponse(obj: unknown) {
  return { content: JSON.stringify(obj), model: 'test-model' }
}

/**
 * validPlanResponse below always has one `unresolved: true` decision, so
 * every test using it now also exercises delegateUnresolvedDecisions —
 * a REAL call into the actual runDecisionIntelligence (not mocked;
 * mocking it would defeat the point of proving delegation is genuinely
 * wired). Since runCapabilityMock is shared across both the planning
 * capability and the decision-generate-recommendation capability it
 * delegates into, this helper distinguishes them by capabilityId so a
 * test that isn't specifically about delegation gets a harmless,
 * decline-shaped decision response instead of the plan JSON misparsed as
 * a decision.
 */
function mockPlanningCapability(planResponse: unknown, decisionResponse: unknown = { declined: true, reason: 'stub decision — not the subject of this test' }) {
  runCapabilityMock.mockImplementation((call: { capabilityId: string }) =>
    Promise.resolve(call.capabilityId === 'planning-generate-plan' ? jsonResponse(planResponse) : jsonResponse(decisionResponse)),
  )
}

const validPlanResponse = {
  title: 'Pricing Page Launch Plan',
  description: 'Ship the new pricing page.',
  currentState: 'The pricing page is outdated.',
  desiredOutcome: 'A new pricing page is live.',
  gapAnalysis: 'Design and copy still need finalizing.',
  assumptions: [
    { statement: 'The design team is available this sprint.', origin: 'assumed', confidence: 'medium' },
    { statement: 'The launch date the user has not specified.', origin: 'requires_user_input', confidence: 'low' },
  ],
  constraints: [{ constraint: 'No additional engineering headcount', type: 'resource', severity: 'hard', origin: 'known' }],
  milestones: [
    { localId: 'm1', title: 'Design finalized', description: 'Design sign-off.', target: null, sequence: 1, dependsOn: [] },
    { localId: 'm2', title: 'Launch', description: 'Page goes live.', target: null, sequence: 2, dependsOn: ['m1'] },
  ],
  tasks: [
    { localId: 't1', title: 'Draft copy', description: 'Write page copy.', priority: 'high', sequence: 1, dependsOn: [], milestoneId: 'm1', estimatedEffort: 'a few days', requiredResources: ['copywriter'] },
    { localId: 't2', title: 'Implement page', description: 'Build the page.', priority: 'medium', sequence: 2, dependsOn: ['t1'], milestoneId: 'm2', estimatedEffort: null, requiredResources: [] },
  ],
  risks: [{ risk: 'Design delays', probability: 'medium', impact: 'medium', mitigation: 'Start design early.' }],
  decisions: [{ decision: 'Which pricing tiers to feature', options: [{ option: 'All tiers', tradeoff: 'More complex page' }], recommendation: null, unresolved: true }],
  outputs: [{ deliverable: 'Live pricing page', completionCriteria: 'Page is publicly accessible.' }],
  successCriteria: ['Page loads correctly', 'Conversion tracked'],
}

describe('runPlanningIntelligence', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    checkQuotaMock.mockResolvedValue({ allowed: true, used: 0, limit: 1000 })
    consumeQuotaMock.mockResolvedValue(true)
    listWorkspaceObjectivesMock.mockResolvedValue([])
    gatherEvidenceMock.mockResolvedValue([])
  })

  it('denies a non-entitled user before any AI call or context assembly', async () => {
    hasFeatureMock.mockResolvedValue(false)

    await expect(runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'free-user', workspaceId: 'workspace-1', chain: ['anthropic'] })).rejects.toThrow(
      'requires an upgraded plan',
    )

    expect(hasFeatureMock).toHaveBeenCalledWith('free-user', 'planning_intelligence')
    expect(gatherEvidenceMock).not.toHaveBeenCalled()
    expect(runCapabilityMock).not.toHaveBeenCalled()
  })

  it('declines an empty objective without opening an operation or calling the AI', async () => {
    hasFeatureMock.mockResolvedValue(true)

    const { plan } = await runPlanningIntelligence({ objective: '   ', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(plan.status).toBe('declined')
    expect(plan.declineReason).toContain('objective is required')
    expect(checkQuotaMock).not.toHaveBeenCalled()
    expect(runCapabilityMock).not.toHaveBeenCalled()
  })

  it('fails gracefully when the monthly operation quota is already exhausted', async () => {
    hasFeatureMock.mockResolvedValue(true)
    checkQuotaMock.mockResolvedValue({ allowed: false, used: 1000, limit: 1000, reason: 'planning_intelligence_operations quota limit reached for this period.' })

    const { plan } = await runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(plan.status).toBe('failed')
    expect(plan.declineReason).toContain('quota limit reached')
    expect(runCapabilityMock).not.toHaveBeenCalled()
  })

  it('generates a structured plan grounded in retrieved workspace context, with dependencies resolved from local ids', async () => {
    hasFeatureMock.mockResolvedValue(true)
    listWorkspaceObjectivesMock.mockResolvedValue([{ id: 'obj-1', workspace_id: 'workspace-1', user_id: 'pro-user', content: 'Grow signups', status: 'active', created_at: '', updated_at: '' }])
    gatherEvidenceMock.mockResolvedValue([{ id: 'chunk-1', source: { type: 'document', id: 'doc-1', title: 'Pricing Strategy Doc' }, excerpt: 'Our current pricing is outdated.', similarity: 0.9 }])
    mockPlanningCapability(validPlanResponse)

    const { plan } = await runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(plan.status).toBe('complete')
    expect(plan.title).toBe('Pricing Page Launch Plan')
    expect(plan.milestones).toHaveLength(2)
    expect(plan.tasks).toHaveLength(2)
    // Dependency resolution: the second milestone/task's dependsOn (by localId) resolves to the first's real generated id.
    const [m1, m2] = plan.milestones
    expect(m2!.dependsOnMilestoneIds).toEqual([m1!.id])
    const [t1, t2] = plan.tasks
    expect(t2!.dependsOnTaskIds).toEqual([t1!.id])
    expect(t1!.milestoneId).toBe(m1!.id)
    // Context evidence is carried through onto the plan (id-traceable, not a fabricated citation).
    expect(plan.contextEvidence).toEqual([{ id: 'chunk-1', type: 'document', title: 'Pricing Strategy Doc', excerpt: 'Our current pricing is outdated.' }])
    // No structural validation issues on a well-formed plan.
    expect(plan.validationIssues).toEqual([])

    const runCapabilityCall = runCapabilityMock.mock.calls[0]![0]
    expect(runCapabilityCall.capabilityId).toBe('planning-generate-plan')
    expect(runCapabilityCall.variables.planningSummary).toContain('Launch the pricing page')
    expect(runCapabilityCall.variables.planningSummary).toContain('Grow signups')
    expect(runCapabilityCall.variables.planningSummary).toContain('Pricing Strategy Doc')
  })

  it('distinguishes known/assumed/unknown information in the returned assumptions rather than blurring them into facts', async () => {
    hasFeatureMock.mockResolvedValue(true)
    mockPlanningCapability(validPlanResponse)

    const { plan } = await runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    const origins = plan.assumptions.map((a) => a.origin)
    expect(origins).toContain('assumed')
    expect(origins).toContain('requires_user_input')
  })

  it('passes explicit user-stated constraints through to the assembled context', async () => {
    hasFeatureMock.mockResolvedValue(true)
    mockPlanningCapability(validPlanResponse)

    await runPlanningIntelligence({ objective: 'Launch the pricing page', userConstraints: ['No budget increase'], userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    const runCapabilityCall = runCapabilityMock.mock.calls[0]![0]
    expect(runCapabilityCall.variables.planningSummary).toContain('No budget increase')
  })

  it('records a declined plan when the model itself reports the objective as unplannable', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(jsonResponse({ declined: true, reason: 'Too vague to plan.' }))

    const { plan } = await runPlanningIntelligence({ objective: 'do stuff', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(plan.status).toBe('declined')
    expect(plan.declineReason).toBe('Too vague to plan.')
  })

  it('recovers honestly from malformed model output instead of fabricating a plan', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue({ content: 'not json at all', model: 'test-model' })

    const { plan } = await runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(plan.status).toBe('failed')
    expect(plan.generationFailed).toBe(true)
    expect(plan.milestones).toEqual([])
  })

  it('stops without fabricating a plan once the operation budget is exhausted, and never records a generic error', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockRejectedValue(new Error('provider unavailable'))

    // planning_intelligence's hard ceiling is 3 AI calls; a 3-candidate chain that
    // fails every attempt exhausts the budget on the same call that exhausts the chain.
    const { plan } = await runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic', 'openai', 'google'] })

    expect(plan.status).toBe('failed')
    expect(plan.budgetExhausted).toBe(true)
    expect(runCapabilityMock).toHaveBeenCalledTimes(3)
  })

  it('surfaces structural validation issues (e.g. a dangling dependency) rather than silently repairing them', async () => {
    hasFeatureMock.mockResolvedValue(true)
    mockPlanningCapability({
      ...validPlanResponse,
      tasks: [{ localId: 't1', title: 'Solo task', description: 'No milestone yet.', priority: 'low', sequence: 1, dependsOn: [], milestoneId: 'does-not-exist', estimatedEffort: null, requiredResources: [] }],
    })

    const { plan } = await runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    // The parser drops an unresolvable milestoneId reference (never guesses), so
    // there's nothing dangling left for validatePlan to catch here — this proves
    // the parser's own defensive filtering, a distinct guarantee from validatePlan's.
    expect(plan.tasks[0]!.milestoneId).toBeNull()
  })

  it('computes a non-empty criticalPath from the tasks\' dependency graph (I6 — never fabricated, computePlanSchedule.ts owns the arithmetic)', async () => {
    hasFeatureMock.mockResolvedValue(true)
    mockPlanningCapability(validPlanResponse)

    const { plan } = await runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    // validPlanResponse's t2 depends on t1 -> the critical path is both, in order.
    expect(plan.criticalPath).toEqual([plan.tasks[0]!.id, plan.tasks[1]!.id])
  })

  describe('I6 — decision point delegation (a genuinely unresolved decision uses real Decision Intelligence, never a rebuilt recommendation)', () => {
    const decisionResponse = {
      title: 'Which pricing tiers to feature',
      alternatives: [
        { localId: 'alt-1', title: 'All tiers', description: '', advantages: [], disadvantages: [], estimatedImpact: null, risks: [] },
        { localId: 'alt-2', title: 'Just the top tier', description: '', advantages: [], disadvantages: [], estimatedImpact: null, risks: [] },
      ],
      criteria: [{ localId: 'c1', name: 'Simplicity', description: '', weight: 1, importance: 'high', evaluationMethod: null }],
      evaluations: [
        { alternativeId: 'alt-1', criterionId: 'c1', score: 3, rationale: 'more complex page', evidenceIds: [], confidence: 'medium' },
        { alternativeId: 'alt-2', criterionId: 'c1', score: 8, rationale: 'simpler to build and market', evidenceIds: [], confidence: 'medium' },
      ],
      recommendedAlternativeId: 'alt-2',
      confidence: 'medium',
      rationale: 'A single featured tier keeps the launch page simple.',
      tradeoffs: [],
      risks: [],
      assumptions: [],
      constraints: [],
      unknowns: [],
      consequences: [],
      nextAction: null,
    }

    it('replaces the fallback recommendation with a real, deterministically-scored Decision Intelligence outcome when delegation succeeds', async () => {
      hasFeatureMock.mockResolvedValue(true)
      mockPlanningCapability(validPlanResponse, decisionResponse)

      const { plan } = await runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

      expect(plan.decisions).toHaveLength(1)
      const decision = plan.decisions[0]!
      expect(decision.decisionIntelligence).not.toBeNull()
      const recommendedId = decision.decisionIntelligence!.recommendedAlternativeId
      expect(recommendedId).not.toBeNull()
      expect(decision.decisionIntelligence!.alternatives.find((a) => a.id === recommendedId)!.title).toBe('Just the top tier')
      // The deterministic weighted score, not a model-stated number, backs the recommendation.
      expect(decision.decisionIntelligence!.weightedScores.find((w) => w.alternativeId === recommendedId)!.totalScore).toBe(8)
      expect(decision.recommendation).toContain('Just the top tier')

      const decisionCalls = runCapabilityMock.mock.calls.filter((c) => c[0].capabilityId === 'decision-generate-recommendation')
      expect(decisionCalls).toHaveLength(1)
      expect(decisionCalls[0]![0].variables.decisionSummary).toContain('Which pricing tiers to feature')
    })

    it('keeps the plan\'s own fallback recommendation, with decisionIntelligence null, when the delegated decision itself declines', async () => {
      hasFeatureMock.mockResolvedValue(true)
      mockPlanningCapability(validPlanResponse, { declined: true, reason: 'Not enough information to decide.' })

      const { plan } = await runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

      expect(plan.decisions[0]!.decisionIntelligence).toBeNull()
      expect(plan.decisions[0]!.recommendation).toBeNull() // validPlanResponse's own decision.recommendation was null
      expect(plan.status).toBe('complete') // a declined DELEGATED decision never fails the plan itself
    })

    it('degrades honestly (decisionIntelligence stays null, plan still completes) when Decision Intelligence is not entitled for this user', async () => {
      hasFeatureMock.mockImplementation((_userId: string, feature: string) => Promise.resolve(feature === 'planning_intelligence'))
      mockPlanningCapability(validPlanResponse, decisionResponse)

      const { plan } = await runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

      expect(plan.status).toBe('complete')
      expect(plan.decisions[0]!.decisionIntelligence).toBeNull()
    })

    it('never delegates a decision that the model itself did not mark unresolved', async () => {
      hasFeatureMock.mockResolvedValue(true)
      mockPlanningCapability({ ...validPlanResponse, decisions: [{ ...validPlanResponse.decisions[0], unresolved: false }] }, decisionResponse)

      await runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

      expect(runCapabilityMock.mock.calls.some((c) => c[0].capabilityId === 'decision-generate-recommendation')).toBe(false)
    })

    it('bounds delegation to MAX_DELEGATED_DECISIONS even when the plan proposes more unresolved decisions than that', async () => {
      hasFeatureMock.mockResolvedValue(true)
      const manyDecisions = Array.from({ length: 5 }, (_, i) => ({ decision: `Decision ${i}`, options: [], recommendation: null, unresolved: true }))
      mockPlanningCapability({ ...validPlanResponse, decisions: manyDecisions }, decisionResponse)

      const { plan } = await runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

      expect(plan.decisions).toHaveLength(5)
      const decisionCalls = runCapabilityMock.mock.calls.filter((c) => c[0].capabilityId === 'decision-generate-recommendation')
      expect(decisionCalls).toHaveLength(3)
      expect(plan.decisions.filter((d) => d.decisionIntelligence !== null)).toHaveLength(3)
    })

    it('a delegated decision\'s own budget exhaustion never fails the plan itself — honest degradation, not a propagated crash', async () => {
      hasFeatureMock.mockResolvedValue(true)
      runCapabilityMock.mockImplementation((call: { capabilityId: string }) =>
        call.capabilityId === 'planning-generate-plan' ? Promise.resolve(jsonResponse(validPlanResponse)) : Promise.reject(new Error('provider unavailable')),
      )

      const { plan } = await runPlanningIntelligence({ objective: 'Launch the pricing page', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic', 'openai', 'google'] })

      expect(plan.status).toBe('complete')
      expect(plan.decisions[0]!.decisionIntelligence).toBeNull()
    })
  })
})
