import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Plan } from '@/modules/planning-intelligence/plan'

const { createIntelligenceRecordMock } = vi.hoisted(() => ({
  createIntelligenceRecordMock: vi.fn(),
}))

vi.mock('@/modules/intelligence-ledger/api/createIntelligenceRecord', () => ({ createIntelligenceRecord: createIntelligenceRecordMock }))

import { recordPlanningIntelligenceRecord } from '@/modules/intelligence-ledger/api/recordPlanningIntelligenceRecord'

function realPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    title: 'University Launch Plan',
    objective: 'Launch ARRIYIA at the university',
    description: null,
    status: 'complete',
    currentState: null,
    desiredOutcome: 'A beta cohort of 50 students actively using ARRIYIA.',
    gapAnalysis: null,
    assumptions: [],
    constraints: [],
    objectives: [],
    workstreams: [],
    milestones: [],
    tasks: [],
    risks: [],
    decisions: [],
    outputs: [],
    successCriteria: ['At least 50 students onboarded', 'Faculty sponsor endorses continuing the pilot'],
    resources: [],
    deadline: null,
    criticalPath: [],
    contextEvidence: [{ id: 'evidence-1', type: 'document', title: 'Prior pilot report', excerpt: 'Prior pilots converted 40% of invited students.' }],
    workspaceId: 'workspace-1',
    createdAt: '2026-01-01T00:00:00Z',
    validationIssues: [],
    revisionOf: null,
    revisionReason: null,
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    ...overrides,
  }
}

describe('recordPlanningIntelligenceRecord', () => {
  beforeEach(() => createIntelligenceRecordMock.mockReset())

  it('persists a real Plan through the actual planningIntelligenceAdapter, using the plan real desiredOutcome as expectedOutcome', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordPlanningIntelligenceRecord({ plan: realPlan(), workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    expect(createIntelligenceRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        recordType: 'planning',
        summary: 'Plan: University Launch Plan',
        operationId: 'operation-1',
        providerId: 'openai',
        expectedOutcome: 'A beta cohort of 50 students actively using ARRIYIA.',
      }),
    )

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    expect(call.provenance.evidence).toHaveLength(1)
  })

  it('falls back to successCriteria joined together when the plan has no single desiredOutcome narrative', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordPlanningIntelligenceRecord({ plan: realPlan({ desiredOutcome: null }), workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    expect(createIntelligenceRecordMock.mock.calls[0]![0].expectedOutcome).toBe('At least 50 students onboarded; Faculty sponsor endorses continuing the pilot')
  })

  it('never fabricates an expectedOutcome when the plan has neither a desiredOutcome nor successCriteria', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordPlanningIntelligenceRecord({ plan: realPlan({ desiredOutcome: null, successCriteria: [] }), workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    expect(createIntelligenceRecordMock.mock.calls[0]![0].expectedOutcome).toBeNull()
  })

  it('never sets a parentRecordId — Planning Intelligence has no real originating Ledger record id to cite', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordPlanningIntelligenceRecord({ plan: realPlan(), workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    expect(createIntelligenceRecordMock.mock.calls[0]![0].parentRecordId).toBeUndefined()
  })
})
