import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/modules/action-intelligence/module'

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

import { runActionIntelligence } from '@/modules/action-intelligence/api/runActionIntelligence'

function jsonResponse(obj: unknown) {
  return { content: JSON.stringify(obj), model: 'test-model' }
}

const validActionSetResponse = {
  title: 'Launch Actions',
  actions: [
    {
      localId: 'act1',
      title: 'Finalize pricing',
      description: 'Decide on the final pricing tier before anything downstream can proceed.',
      type: 'decision_required',
      priority: 'high',
      sequence: 1,
      dependsOn: [],
      actor: { type: 'unassigned', label: null },
      expectedOutput: { outcome: 'Pricing is locked', completionCriteria: 'Pricing page reflects final numbers' },
      dueHint: null,
    },
    {
      localId: 'act2',
      title: 'Send revised proposal to client',
      description: 'Send the client the updated proposal once pricing is settled.',
      type: 'action',
      priority: 'medium',
      sequence: 2,
      dependsOn: [{ kind: 'decision', description: 'Finalize pricing' }],
      actor: { type: 'described', label: 'the account manager' },
      expectedOutput: { outcome: 'Client has the proposal', completionCriteria: null },
      dueHint: 'before the semester starts',
      evidenceNumbers: [1],
    },
    {
      localId: 'act3',
      title: 'Draft outreach email',
      description: 'Write the outreach email for the beta cohort.',
      type: 'task',
      priority: 'low',
      sequence: 3,
      dependsOn: [],
      actor: { type: 'described', label: 'the marketing team' },
      expectedOutput: { outcome: 'Draft ready for review', completionCriteria: null },
      dueHint: null,
    },
  ],
}

describe('runActionIntelligence', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    checkQuotaMock.mockResolvedValue({ allowed: true, used: 0, limit: 1000 })
    consumeQuotaMock.mockResolvedValue(true)
    listWorkspaceObjectivesMock.mockResolvedValue([])
    gatherEvidenceMock.mockResolvedValue([])
  })

  it('denies a non-entitled user before any AI call or context assembly', async () => {
    hasFeatureMock.mockResolvedValue(false)

    await expect(runActionIntelligence({ instruction: 'Ship the beta', userId: 'free-user', workspaceId: 'workspace-1', chain: ['anthropic'] })).rejects.toThrow('requires an upgraded plan')

    expect(hasFeatureMock).toHaveBeenCalledWith('free-user', 'action_intelligence')
    expect(gatherEvidenceMock).not.toHaveBeenCalled()
    expect(runCapabilityMock).not.toHaveBeenCalled()
  })

  it('declines with no operation opened when neither instruction, objective, plan, nor decision is supplied', async () => {
    hasFeatureMock.mockResolvedValue(true)

    const { actionSet } = await runActionIntelligence({ userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(actionSet.status).toBe('declined')
    expect(actionSet.declineReason).toContain('instruction, objective, plan, or decision is required')
    expect(checkQuotaMock).not.toHaveBeenCalled()
    expect(runCapabilityMock).not.toHaveBeenCalled()
  })

  it('fails gracefully when the monthly operation quota is already exhausted', async () => {
    hasFeatureMock.mockResolvedValue(true)
    checkQuotaMock.mockResolvedValue({ allowed: false, used: 1000, limit: 1000, reason: 'action_intelligence_operations quota limit reached for this period.' })

    const { actionSet } = await runActionIntelligence({ instruction: 'Ship the beta', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(actionSet.status).toBe('failed')
    expect(actionSet.declineReason).toContain('quota limit reached')
    expect(runCapabilityMock).not.toHaveBeenCalled()
  })

  it('stops without fabricating an action set once the operation budget is exhausted', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockRejectedValue(new Error('provider unavailable'))

    // action_intelligence's hard ceiling is 3 AI calls; a 3-candidate chain that
    // fails every attempt exhausts the budget on the same call that exhausts the chain.
    const { actionSet } = await runActionIntelligence({ instruction: 'Ship the beta', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic', 'openai', 'google'] })

    expect(actionSet.status).toBe('failed')
    expect(actionSet.budgetExhausted).toBe(true)
    expect(runCapabilityMock).toHaveBeenCalledTimes(3)
  })

  it('recovers honestly from malformed model output instead of fabricating an action set', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue({ content: 'not json at all', model: 'test-model' })

    const { actionSet } = await runActionIntelligence({ instruction: 'Ship the beta', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(actionSet.status).toBe('failed')
    expect(actionSet.generationFailed).toBe(true)
    expect(actionSet.actions).toEqual([])
  })

  it('records a declined action set when the model reports nothing actionable', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(jsonResponse({ declined: true, reason: 'Nothing real to act on here.' }))

    const { actionSet } = await runActionIntelligence({ instruction: 'huh?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(actionSet.status).toBe('declined')
    expect(actionSet.declineReason).toBe('Nothing real to act on here.')
  })

  it('generates a complete action set from an explicit instruction alone, with deterministic readiness and priorities computed by the application', async () => {
    hasFeatureMock.mockResolvedValue(true)
    gatherEvidenceMock.mockResolvedValue([{ id: 'chunk-1', source: { type: 'document', id: 'doc-1', title: 'Semester Calendar' }, excerpt: 'The semester starts in September.', similarity: 0.9 }])
    runCapabilityMock.mockResolvedValue(jsonResponse(validActionSetResponse))

    const { actionSet } = await runActionIntelligence({ instruction: 'Prepare the client launch', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(actionSet.status).toBe('complete')
    expect(actionSet.actions).toHaveLength(3)

    const pricing = actionSet.actions.find((a) => a.title === 'Finalize pricing')!
    const proposal = actionSet.actions.find((a) => a.title === 'Send revised proposal to client')!
    const draft = actionSet.actions.find((a) => a.title === 'Draft outreach email')!

    // The worked example: an action blocked by an unresolved decision is never presented as ready,
    // regardless of anything the model itself might have implied.
    expect(pricing.readiness.state).toBe('needs_decision')
    expect(proposal.readiness.state).toBe('needs_decision')
    expect(proposal.readiness.blockers[0]).toContain('Finalize pricing')

    // draft has a described (non-user) actor with a real label, so it's genuinely ready.
    expect(draft.readiness.state).toBe('ready')

    // Priority bump: proposal has a genuine dueHint, so its declared 'medium' priority is bumped to 'high'.
    expect(proposal.priority).toBe('high')

    expect(actionSet.contextEvidence).toEqual([{ id: 'chunk-1', type: 'document', title: 'Semester Calendar', excerpt: 'The semester starts in September.' }])
    expect(actionSet.validationIssues).toEqual([])

    // Every action shares one consistent, honestly-derived source (instruction-only in this case).
    for (const action of actionSet.actions) expect(action.source).toEqual({ kind: 'user_instruction', label: 'Prepare the client launch', planId: null, decisionId: null })

    const call = runCapabilityMock.mock.calls[0]![0]
    expect(call.capabilityId).toBe('action-generate-action-set')
    expect(call.variables.actionSummary).toContain('Prepare the client launch')
  })

  it('generates actions from a Plan alone, threading Planning Intelligence context into the prompt without Action depending on Plan internals', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(jsonResponse({ title: 'Plan Actions', actions: [{ localId: 'a1', title: 'Onboard beta cohort', type: 'action', priority: 'medium', actor: { type: 'user', label: null } }] }))

    const { actionSet } = await runActionIntelligence({
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      chain: ['anthropic'],
      planContext: { planId: 'plan-1', planTitle: 'University Launch Plan', planObjective: 'Launch at the university', relevantMilestones: ['Beta cohort onboarded'], relevantTasks: [], relevantConstraints: [] },
    })

    expect(actionSet.status).toBe('complete')
    expect(actionSet.actions[0]!.source).toEqual({ kind: 'plan', label: 'University Launch Plan', planId: 'plan-1', decisionId: null })

    const call = runCapabilityMock.mock.calls[0]![0]
    expect(call.variables.actionSummary).toContain('University Launch Plan')
    expect(call.variables.actionSummary).toContain('Beta cohort onboarded')
  })

  it('generates actions from a Decision alone, threading Decision Intelligence context into the prompt without Action depending on Decision internals', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(jsonResponse({ title: 'Decision Actions', actions: [{ localId: 'a1', title: 'Announce launch strategy', type: 'action', priority: 'medium', actor: { type: 'user', label: null } }] }))

    const { actionSet } = await runActionIntelligence({
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      chain: ['anthropic'],
      decisionContext: { decisionId: 'decision-1', decisionQuestion: 'Which launch strategy?', recommendedAlternative: 'Student-first', rationale: 'Faster adoption.', nextAction: null, relevantRisks: [], provisional: false },
    })

    expect(actionSet.status).toBe('complete')
    expect(actionSet.actions[0]!.source).toEqual({ kind: 'decision', label: 'Which launch strategy?', planId: null, decisionId: 'decision-1' })

    const call = runCapabilityMock.mock.calls[0]![0]
    expect(call.variables.actionSummary).toContain('Which launch strategy?')
    expect(call.variables.actionSummary).toContain('Student-first')
  })

  it('generates actions from both a Plan and a Decision together, attributing source to the decision (the more proximate cause of the actions)', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(jsonResponse({ title: 'Combined Actions', actions: [{ localId: 'a1', title: 'Execute launch', type: 'action', priority: 'medium', actor: { type: 'user', label: null } }] }))

    const { actionSet } = await runActionIntelligence({
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      chain: ['anthropic'],
      planContext: { planId: 'plan-1', planTitle: 'University Launch Plan', planObjective: 'Launch at the university', relevantMilestones: [], relevantTasks: [], relevantConstraints: [] },
      decisionContext: { decisionId: 'decision-1', decisionQuestion: 'Which launch strategy?', recommendedAlternative: 'Student-first', rationale: null, nextAction: null, relevantRisks: [], provisional: false },
    })

    expect(actionSet.status).toBe('complete')
    expect(actionSet.actions[0]!.source.kind).toBe('decision')
    // I7: both real upstream ids are preserved even though 'decision' won as the batch's own kind/label.
    expect(actionSet.actions[0]!.source.planId).toBe('plan-1')
    expect(actionSet.actions[0]!.source.decisionId).toBe('decision-1')

    const call = runCapabilityMock.mock.calls[0]![0]
    expect(call.variables.actionSummary).toContain('University Launch Plan')
    expect(call.variables.actionSummary).toContain('Which launch strategy?')
  })

  it('surfaces a dependency-cycle validation issue on the returned action set without crashing', async () => {
    hasFeatureMock.mockResolvedValue(true)
    runCapabilityMock.mockResolvedValue(
      jsonResponse({
        title: 'Cyclic Actions',
        actions: [
          { localId: 'a1', title: 'A', type: 'action', priority: 'medium', actor: { type: 'user', label: null }, dependsOn: [{ kind: 'action', targetLocalId: 'a2', description: 'x' }] },
          { localId: 'a2', title: 'B', type: 'action', priority: 'medium', actor: { type: 'user', label: null }, dependsOn: [{ kind: 'action', targetLocalId: 'a1', description: 'x' }] },
        ],
      }),
    )

    const { actionSet } = await runActionIntelligence({ instruction: 'Do A and B', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(actionSet.status).toBe('complete')
    expect(actionSet.validationIssues.some((i) => i.kind === 'circular_dependency')).toBe(true)
    expect(actionSet.actions.every((a) => a.readiness.state === 'blocked')).toBe(true)
  })
})
