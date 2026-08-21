import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/modules/decision-intelligence/module'
import '@/modules/analysis-intelligence/module'

const {
  hasFeatureMock,
  runCapabilityMock,
  listWorkspaceObjectivesMock,
  gatherEvidenceMock,
  checkQuotaMock,
  consumeQuotaMock,
  listStructuredDatasetsForDocumentMock,
  getStructuredDatasetMock,
  getChatProviderMock,
  streamChatCompletionMock,
} = vi.hoisted(() => ({
  hasFeatureMock: vi.fn(),
  runCapabilityMock: vi.fn(),
  listWorkspaceObjectivesMock: vi.fn(),
  gatherEvidenceMock: vi.fn(),
  checkQuotaMock: vi.fn(),
  consumeQuotaMock: vi.fn(),
  listStructuredDatasetsForDocumentMock: vi.fn(),
  getStructuredDatasetMock: vi.fn(),
  getChatProviderMock: vi.fn(),
  streamChatCompletionMock: vi.fn(),
}))

vi.mock('@/modules/plans/api/plans', () => ({ hasFeature: hasFeatureMock }))
vi.mock('@/modules/ai/orchestration/runCapability', () => ({ runCapability: runCapabilityMock }))
vi.mock('@/modules/hub/api/objectives', () => ({ listWorkspaceObjectives: listWorkspaceObjectivesMock }))
vi.mock('@/modules/research-intelligence/gatherEvidence', () => ({ gatherEvidence: gatherEvidenceMock }))
vi.mock('@/shared/lib/quotaService', () => ({ quotaService: { checkQuota: checkQuotaMock, consumeQuota: consumeQuotaMock } }))
// The dataset-delegation path (buildDecisionContext.ts -> runAnalysisInvestigation, real and
// unmodified) needs its own dependencies mocked, mirroring researchInvestigation.acceptance.test.ts's
// identical setup for the exact same delegation.
vi.mock('@/modules/data-intelligence/api/structuredDatasets', () => ({
  getStructuredDataset: getStructuredDatasetMock,
  listStructuredDatasetsForDocument: listStructuredDatasetsForDocumentMock,
}))
vi.mock('@/modules/ai/providers/registry', () => ({ getChatProvider: getChatProviderMock, DEFAULT_CHAT_PROVIDER_ID: 'anthropic' }))
vi.mock('@/modules/ai/orchestration/streamChatCompletion', () => ({ streamChatCompletion: streamChatCompletionMock }))

import { runDecisionIntelligence } from '@/modules/decision-intelligence/api/runDecisionIntelligence'
import { decisionToProvenance } from '@/shared/provenance/adapters/decisionIntelligenceAdapter'
import { resolveEvidenceChain, toLookup } from '@/shared/provenance/resolveEvidenceChain'

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
    listStructuredDatasetsForDocumentMock.mockResolvedValue([])
    getChatProviderMock.mockReturnValue({ id: 'anthropic' })
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

  it('propagates a genuine total-provider-outage failure rather than mislabeling it budget-exhausted, when the shared budget itself still has headroom', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockRejectedValue(new Error('provider unavailable'))

    // decision_intelligence's hard ceiling (21) now accommodates an optional Analysis
    // Intelligence delegation, so a 3-candidate chain failing entirely at decision's own
    // single call site (3 of 21 calls consumed) does NOT exhaust the shared budget — this
    // is a genuine provider outage, not a budget condition, exactly the same distinction
    // Research/Analysis Intelligence's own single-call-site failures already preserve.
    await expect(runDecisionIntelligence({ question: 'Which strategy?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic', 'openai', 'google'] })).rejects.toThrow(
      'provider unavailable',
    )
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

  describe('dataset delegation (I5 fix — a decision scoped to a document with a real structured dataset)', () => {
    const VENDOR_DATASET = {
      id: 'dataset-1',
      documentId: 'doc-costs',
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      sheetIndex: 0,
      sheetName: 'Vendor Costs',
      columns: [
        { name: 'Vendor', meaning: 'category' as const, dataType: 'category' as const, columnIndex: 0, hasFormulas: false, distinctCount: 2, nonEmptyCount: 4 },
        { name: 'Cost', meaning: 'metric' as const, dataType: 'number' as const, columnIndex: 1, hasFormulas: false, distinctCount: 4, nonEmptyCount: 4 },
      ],
      rows: [
        ['Vendor A', 500],
        ['Vendor A', 520],
        ['Vendor B', 300],
        ['Vendor B', 310],
      ],
      rowCount: 4,
      columnCount: 2,
    }

    function jsonStream(obj: unknown) {
      return { content: JSON.stringify(obj), model: 'test-model' }
    }

    it('delegates to a real Analysis Investigation for a deterministic, dataset-grounded number, threads it into contextEvidence and provenance, and shares one operation budget', async () => {
      hasFeatureMock.mockResolvedValue(true)
      listStructuredDatasetsForDocumentMock.mockResolvedValue([{ id: 'dataset-1', sheetIndex: 0, sheetName: 'Vendor Costs', rowCount: 4, columnCount: 2 }])
      getStructuredDatasetMock.mockResolvedValue(VENDOR_DATASET)

      streamChatCompletionMock
        // Analysis Intelligence's own step planner (real runAnalysisInvestigation running underneath).
        .mockResolvedValueOnce(
          jsonStream({
            purpose: 'baseline: average cost by vendor',
            hypothesis: null,
            plan: { dimensions: [{ column: 'Vendor' }], measures: [{ as: 'avgCost', aggregation: 'avg', column: 'Cost' }] },
          }),
        )
        .mockResolvedValueOnce(jsonStream({ stop: true, reason: 'baseline established' }))

      runCapabilityMock
        // Analysis Intelligence's own synthesis (its own registered capability).
        .mockResolvedValueOnce({ content: 'Vendor B has a lower average cost (305) than Vendor A (510) in the uploaded data.', model: 'm' })
        // Decision Intelligence's own final call.
        .mockResolvedValueOnce(
          jsonResponse({
            ...validDecisionResponse,
            title: 'Vendor Selection Decision',
            alternatives: [
              { localId: 'a1', title: 'Vendor A', description: 'Existing vendor.', advantages: [], disadvantages: ['Higher average cost'], estimatedImpact: null, risks: [], evidenceNumbers: [1] },
              { localId: 'a2', title: 'Vendor B', description: 'Lower-cost vendor.', advantages: ['Lower average cost'], disadvantages: [], estimatedImpact: null, risks: [], evidenceNumbers: [1] },
            ],
            criteria: [{ localId: 'c1', name: 'Cost', description: 'Average cost per order', weight: 8, importance: 'high', evaluationMethod: 'lower is better' }],
            evaluations: [
              { alternativeId: 'a1', criterionId: 'c1', score: 3, rationale: 'Vendor A averages $510 per the deterministic dataset breakdown.', confidence: 'high', evidenceNumbers: [1] },
              { alternativeId: 'a2', criterionId: 'c1', score: 8, rationale: 'Vendor B averages $305 per the deterministic dataset breakdown.', confidence: 'high', evidenceNumbers: [1] },
            ],
            recommendedAlternativeId: 'a2',
            rationale: 'Vendor B is materially cheaper per the deterministic dataset analysis.',
          }),
        )

      const { decision } = await runDecisionIntelligence({
        question: 'Which vendor should we choose for the pilot?',
        documentId: 'doc-costs',
        userId: 'pro-user',
        workspaceId: 'workspace-1',
        chain: ['anthropic'],
      })

      expect(decision.status).toBe('complete')

      // The nested AnalysisInvestigation is real and exposed unmodified — its own numbers are independently verifiable, never recomputed by Decision.
      expect(decision.datasetInvestigation).not.toBeNull()
      const analysisStep = decision.datasetInvestigation!.steps[0]!
      expect(analysisStep.result.status).toBe('ok')
      const avgCostByVendor = analysisStep.result.status === 'ok' ? Object.fromEntries(analysisStep.result.rows.map((r) => [r.dimensions.Vendor, r.measures.avgCost])) : {}
      expect(avgCostByVendor['Vendor A']).toBeCloseTo((500 + 520) / 2, 10)
      expect(avgCostByVendor['Vendor B']).toBeCloseTo((300 + 310) / 2, 10)

      // The dataset investigation's synthesis reached contextEvidence as one more numbered, citable source.
      const datasetEvidence = decision.contextEvidence.find((e) => e.type === 'dataset_investigation')
      expect(datasetEvidence).toBeDefined()
      expect(datasetEvidence!.excerpt).toContain('305')

      // Both evaluations that cited it resolved to the real evidence id, never a fabricated citation.
      expect(decision.evaluations.every((e) => e.evidenceIds.includes(datasetEvidence!.id))).toBe(true)
      expect(decision.recommendedAlternativeId).toBe(decision.alternatives.find((a) => a.title === 'Vendor B')!.id)

      // Provenance — resolves from the decision synthesis through the evaluation observations down to the real, nested Analysis Investigation's own chain (Data -> Analysis -> Decision, three engines).
      const chain = decisionToProvenance(decision)
      const decisionSynthesis = chain.derivations.find((d) => d.kind === 'synthesis' && d.id.startsWith('decision:'))!
      const resolved = resolveEvidenceChain(decisionSynthesis.id, toLookup(chain))!
      const sourceTypesInChain = new Set<string>()
      ;(function collect(node: typeof resolved) {
        for (const e of node.evidence) sourceTypesInChain.add(e.source.type)
        for (const p of node.priorDerivations) collect(p)
      })(resolved)
      expect(sourceTypesInChain.has('dataset')).toBe(true)

      // One shared operation budget — no second independent quota was opened for the delegated Analysis call.
      expect(checkQuotaMock).toHaveBeenCalledTimes(1)
      expect(checkQuotaMock).toHaveBeenCalledWith('pro-user', 'decision_intelligence_operations')
    })

    it('degrades honestly to no dataset evidence when the document has no structured dataset, never fabricating a delegation result', async () => {
      hasFeatureMock.mockResolvedValue(true)
      listStructuredDatasetsForDocumentMock.mockResolvedValue([])
      runCapabilityMock.mockResolvedValue(jsonResponse(validDecisionResponse))

      const { decision } = await runDecisionIntelligence({ question: 'Which strategy?', documentId: 'doc-no-dataset', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

      expect(decision.datasetInvestigation).toBeNull()
      expect(decision.contextEvidence.some((e) => e.type === 'dataset_investigation')).toBe(false)
      expect(getStructuredDatasetMock).not.toHaveBeenCalled()
    })

    it('marks the decision budgetExhausted (never fabricating a recommendation) when the delegated Analysis call alone exhausts the shared operation budget', async () => {
      hasFeatureMock.mockResolvedValue(true)
      listStructuredDatasetsForDocumentMock.mockResolvedValue([{ id: 'dataset-1', sheetIndex: 0, sheetName: 'Vendor Costs', rowCount: 4, columnCount: 2 }])
      getStructuredDatasetMock.mockResolvedValue(VENDOR_DATASET)
      // decision_intelligence's shared hard ceiling is 21 AI calls; a 21-candidate chain that
      // fails on every attempt during Analysis Intelligence's own first step-planner call
      // exhausts the whole shared budget before Decision's own call ever runs.
      const chain = Array.from({ length: 21 }, (_, i) => `p${i}`)
      streamChatCompletionMock.mockRejectedValue(new Error('provider down'))

      const { decision } = await runDecisionIntelligence({ question: 'Which vendor should we choose?', documentId: 'doc-costs', userId: 'pro-user', workspaceId: 'workspace-1', chain })

      expect(decision.status).toBe('failed')
      expect(decision.budgetExhausted).toBe(true)
      expect(decision.alternatives).toEqual([])
      expect(runCapabilityMock).not.toHaveBeenCalled()
    })
  })
})
