import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/modules/decision-intelligence/module'

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
vi.mock('@/shared/lib/quotaService', () => ({ quotaService: { checkQuota: checkQuotaMock, consumeQuota: consumeQuotaMock } }))

import { runDecisionIntelligence } from '@/modules/decision-intelligence/api/runDecisionIntelligence'

function jsonResponse(obj: unknown) {
  return { content: JSON.stringify(obj), model: 'test-model' }
}

const validDecisionResponse = {
  title: 'Launch Strategy Decision',
  alternatives: [
    { localId: 'a1', title: 'Student-first', description: 'Launch to students first.', advantages: ['faster adoption'], disadvantages: ['less institutional buy-in'], estimatedImpact: null, risks: [] },
    { localId: 'a2', title: 'Lecturer-first', description: 'Launch to lecturers first.', advantages: ['institutional credibility'], disadvantages: ['slower adoption'], estimatedImpact: null, risks: [] },
  ],
  criteria: [{ localId: 'c1', name: 'Speed of adoption', description: 'How fast users sign up', weight: 5, importance: 'high', evaluationMethod: null }],
  evaluations: [
    { alternativeId: 'a1', criterionId: 'c1', score: 8, rationale: 'students adopt faster', confidence: 'medium', evidenceNumbers: [1] },
    { alternativeId: 'a2', criterionId: 'c1', score: 4, rationale: 'lecturers are slower to adopt', confidence: 'medium' },
  ],
  risks: [{ description: 'Students may churn without institutional support', likelihood: 'medium', impact: 'medium', mitigation: 'follow up with lecturer outreach' }],
  assumptions: [
    { statement: 'Students have reliable internet access', origin: 'assumed', impactIfFalse: 'adoption would be slower than expected' },
    { statement: 'Budget for the launch has not been finalized', origin: 'requires_user_input', impactIfFalse: null },
  ],
  constraints: [{ constraint: 'Must launch before the semester starts', type: 'time', severity: 'hard' }],
  unknowns: ['Whether the university IT office will approve campus-wide promotion'],
  consequences: ['Early student adopters may become informal campus ambassadors'],
  recommendedAlternativeId: 'a1',
  confidence: 'medium',
  rationale: 'Students adopt faster and the evidence supports quicker early traction.',
  tradeoffs: ['Slower institutional credibility if lecturers are not engaged early'],
  nextAction: 'Prepare a student-focused launch campaign',
}

describe('runDecisionIntelligence', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    checkQuotaMock.mockResolvedValue({ allowed: true, used: 0, limit: 1000 })
    consumeQuotaMock.mockResolvedValue(true)
    listWorkspaceObjectivesMock.mockResolvedValue([])
    gatherEvidenceMock.mockResolvedValue([])
  })

  it('denies a non-entitled user before any AI call or context assembly', async () => {
    hasFeatureMock.mockResolvedValue(false)

    await expect(runDecisionIntelligence({ question: 'Which launch strategy?', userId: 'free-user', workspaceId: 'workspace-1', chain: ['anthropic'] })).rejects.toThrow(
      'requires an upgraded plan',
    )

    expect(hasFeatureMock).toHaveBeenCalledWith('free-user', 'decision_intelligence')
    expect(gatherEvidenceMock).not.toHaveBeenCalled()
    expect(runCapabilityMock).not.toHaveBeenCalled()
  })

  it('declines an empty question without opening an operation or calling the AI', async () => {
    hasFeatureMock.mockResolvedValue(true)

    const { decision } = await runDecisionIntelligence({ question: '   ', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(decision.status).toBe('declined')
    expect(decision.declineReason).toContain('question is required')
    expect(checkQuotaMock).not.toHaveBeenCalled()
    expect(runCapabilityMock).not.toHaveBeenCalled()
  })

  it('fails gracefully when the monthly operation quota is already exhausted', async () => {
    hasFeatureMock.mockResolvedValue(true)
    checkQuotaMock.mockResolvedValue({ allowed: false, used: 1000, limit: 1000, reason: 'decision_intelligence_operations quota limit reached for this period.' })

    const { decision } = await runDecisionIntelligence({ question: 'Which strategy?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(decision.status).toBe('failed')
    expect(decision.declineReason).toContain('quota limit reached')
    expect(runCapabilityMock).not.toHaveBeenCalled()
  })

  it('produces a complete decision with deterministically computed weighted scores, sensitivity, and provenance-ready context evidence', async () => {
    hasFeatureMock.mockResolvedValue(true)
    gatherEvidenceMock.mockResolvedValue([{ id: 'chunk-1', source: { type: 'document', id: 'doc-1', title: 'Adoption Study' }, excerpt: 'Students adopt new tools faster than staff.', similarity: 0.9 }])
    runCapabilityMock.mockResolvedValue(jsonResponse(validDecisionResponse))

    const { decision } = await runDecisionIntelligence({ question: 'Should launch be student-first, lecturer-first, or simultaneous?', objective: 'Maximize adoption', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(decision.status).toBe('complete')
    expect(decision.alternatives).toHaveLength(2)
    expect(decision.weightedScores).toHaveLength(2)
    // a1 (score 8) should beat a2 (score 4) deterministically.
    const ranked = [...decision.weightedScores].sort((a, b) => b.totalScore - a.totalScore)
    expect(ranked[0]!.alternativeId).toBe(decision.recommendedAlternativeId)
    expect(decision.contextEvidence).toEqual([{ id: 'chunk-1', type: 'document', title: 'Adoption Study', excerpt: 'Students adopt new tools faster than staff.' }])
    expect(decision.validationIssues).toEqual([])
    // Provisional because of the genuine unknown the model reported.
    expect(decision.provisional).toBe(true)
    expect(decision.provisionalReason).toContain('IT office')

    const call = runCapabilityMock.mock.calls[0]![0]
    expect(call.capabilityId).toBe('decision-generate-recommendation')
    expect(call.variables.decisionSummary).toContain('student-first')
    expect(call.variables.decisionSummary).toContain('Maximize adoption')
  })

  it('distinguishes known/assumed/requires_user_input origins in the returned assumptions', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(jsonResponse(validDecisionResponse))

    const { decision } = await runDecisionIntelligence({ question: 'Which strategy?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    const origins = decision.assumptions.map((a) => a.origin)
    expect(origins).toContain('assumed')
    expect(origins).toContain('requires_user_input')
  })

  it('records a declined decision when the model reports the question as unanalyzable', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(jsonResponse({ declined: true, reason: 'Not enough real alternatives to compare.' }))

    const { decision } = await runDecisionIntelligence({ question: 'huh?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(decision.status).toBe('declined')
    expect(decision.declineReason).toBe('Not enough real alternatives to compare.')
  })

  it('recovers honestly from malformed model output instead of fabricating a decision', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue({ content: 'not json at all', model: 'test-model' })

    const { decision } = await runDecisionIntelligence({ question: 'Which strategy?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(decision.status).toBe('failed')
    expect(decision.generationFailed).toBe(true)
    expect(decision.alternatives).toEqual([])
  })

  it('stops without fabricating a decision once the operation budget is exhausted', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockRejectedValue(new Error('provider unavailable'))

    // decision_intelligence's hard ceiling is 3 AI calls; a 3-candidate chain that
    // fails every attempt exhausts the budget on the same call that exhausts the chain.
    const { decision } = await runDecisionIntelligence({ question: 'Which strategy?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic', 'openai', 'google'] })

    expect(decision.status).toBe('failed')
    expect(decision.budgetExhausted).toBe(true)
    expect(runCapabilityMock).toHaveBeenCalledTimes(3)
  })

  it('caps an unsupported "high" confidence claim to "medium" and marks the decision provisional', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(
      jsonResponse({
        ...validDecisionResponse,
        confidence: 'high',
        evaluations: validDecisionResponse.evaluations.map((e) => ({ ...e, evidenceNumbers: undefined })), // no evidence cited anywhere
        unknowns: [],
      }),
    )

    const { decision } = await runDecisionIntelligence({ question: 'Which strategy?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(decision.confidence).toBe('medium')
    expect(decision.provisional).toBe(true)
    expect(decision.validationIssues.some((i) => i.kind === 'unsupported_certainty')).toBe(true)
  })

  it('threads Planning Intelligence context into the decision prompt when a plan is supplied, without requiring Decision to depend on Plan internals', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(jsonResponse(validDecisionResponse))

    await runDecisionIntelligence({
      question: 'Which strategy?',
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      chain: ['anthropic'],
      plan: { planTitle: 'University Launch Plan', planObjective: 'Launch ARRIYIA at the university', relevantMilestones: ['Beta cohort onboarded'], relevantConstraints: ['No paid ads budget'], relevantRisks: ['Low awareness'], relevantAssumptions: [] },
    })

    const call = runCapabilityMock.mock.calls[0]![0]
    expect(call.variables.decisionSummary).toContain('University Launch Plan')
    expect(call.variables.decisionSummary).toContain('Beta cohort onboarded')
    expect(call.variables.decisionSummary).toContain('No paid ads budget')
  })
})
