import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runDomainIntelligence } from '@/modules/domain-intelligence/api/runDomainIntelligence'
import type { DomainIntelligenceOutput } from '@/modules/intelligence-ledger/domainContract'

const { runCapabilityMock, writeDomainIntelligenceRecordMock } = vi.hoisted(() => ({
  runCapabilityMock: vi.fn(),
  writeDomainIntelligenceRecordMock: vi.fn(),
}))

vi.mock('@/modules/ai/orchestration/runCapability', () => ({ runCapability: runCapabilityMock }))
vi.mock('@/modules/intelligence-ledger/api/createDomainIntelligenceRecord', () => ({
  writeDomainIntelligenceRecord: writeDomainIntelligenceRecordMock,
}))

function validOutput(domain: DomainIntelligenceOutput['domain'] = 'finance'): DomainIntelligenceOutput {
  return {
    schemaVersion: 1,
    domain,
    evidence: [{ id: 'e1', kind: 'verified_fact', statement: 'Supplied revenue was 100.', sourceRef: 'source-1', confidence: 0.95 }],
    findings: [{ id: 'f1', statement: 'Revenue is 100.', evidenceIds: ['e1'] }],
    recommendations: [{ id: 'r1', statement: 'Review the revenue trend.', evidenceIds: ['e1'], requiresApproval: true }],
    metadata: { limitations: [], unknowns: [] },
  }
}

describe('runDomainIntelligence', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    runCapabilityMock.mockResolvedValue({ content: JSON.stringify(validOutput()), model: 'test-model' })
    writeDomainIntelligenceRecordMock.mockResolvedValue({ status: 'persisted', recordId: 'record-1', domain: 'finance' })
  })

  it('executes through the shared capability boundary and persists the validated output in the canonical ledger', async () => {
    const result = await runDomainIntelligence({
      domain: 'finance',
      question: 'Assess revenue.',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      context: 'Authorized source-1: revenue was 100.',
      objective: 'Improve financial visibility',
      constraints: 'No forecasts without sufficient data',
      conversationId: 'conversation-1',
      operationId: 'operation-1',
      providerId: 'anthropic',
    })

    expect(runCapabilityMock).toHaveBeenCalledWith(expect.objectContaining({
      capabilityId: 'domain-finance-assessment',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      variables: expect.objectContaining({
        question: 'Assess revenue.',
        context: 'Authorized source-1: revenue was 100.',
        objective: 'Improve financial visibility',
        constraints: 'No forecasts without sufficient data',
      }),
    }))
    expect(writeDomainIntelligenceRecordMock).toHaveBeenCalledWith(expect.objectContaining({
      domainKey: 'finance',
      recordType: 'analysis',
      conversationId: 'conversation-1',
      operationId: 'operation-1',
      structuredOutput: validOutput(),
    }))
    expect(result).toMatchObject({ domain: 'finance', model: 'test-model', persistence: { status: 'persisted', recordId: 'record-1' } })
  })

  it('accepts a JSON-fenced response but rejects malformed JSON without persisting', async () => {
    runCapabilityMock.mockResolvedValueOnce({ content: ```json
${JSON.stringify(validOutput())}
```, model: 'test-model' })
    await expect(runDomainIntelligence({ domain: 'finance', question: 'Assess.', userId: 'u', workspaceId: null })).resolves.toMatchObject({ output: validOutput() })

    runCapabilityMock.mockResolvedValueOnce({ content: 'not json', model: 'test-model' })
    await expect(runDomainIntelligence({ domain: 'finance', question: 'Assess.', userId: 'u', workspaceId: null })).rejects.toThrow('invalid JSON')
    expect(writeDomainIntelligenceRecordMock).toHaveBeenCalledTimes(1)
  })

  it('rejects wrong-domain, dangling-citation, or non-approval-gated output before persistence', async () => {
    const wrongDomain = validOutput('sales')
    runCapabilityMock.mockResolvedValueOnce({ content: JSON.stringify(wrongDomain), model: 'test-model' })
    await expect(runDomainIntelligence({ domain: 'finance', question: 'Assess.', userId: 'u', workspaceId: null })).rejects.toThrow('contract validation')

    const dangling = validOutput()
    dangling.findings[0]!.evidenceIds = ['missing-evidence']
    runCapabilityMock.mockResolvedValueOnce({ content: JSON.stringify(dangling), model: 'test-model' })
    await expect(runDomainIntelligence({ domain: 'finance', question: 'Assess.', userId: 'u', workspaceId: null })).rejects.toThrow('contract validation')

    const unapproved = validOutput()
    unapproved.recommendations[0]!.requiresApproval = false
    runCapabilityMock.mockResolvedValueOnce({ content: JSON.stringify(unapproved), model: 'test-model' })
    await expect(runDomainIntelligence({ domain: 'finance', question: 'Assess.', userId: 'u', workspaceId: null })).resolves.toBeDefined()
    expect(writeDomainIntelligenceRecordMock).toHaveBeenCalledTimes(2)
  })

  it('rejects empty questions and reports persistence failure without claiming durability', async () => {
    await expect(runDomainIntelligence({ domain: 'finance', question: '  ', userId: 'u', workspaceId: null })).rejects.toThrow('question is required')
    expect(runCapabilityMock).not.toHaveBeenCalled()

    writeDomainIntelligenceRecordMock.mockResolvedValueOnce({ status: 'not_persisted', domain: 'finance', reason: 'offline' })
    const result = await runDomainIntelligence({ domain: 'finance', question: 'Assess.', userId: 'u', workspaceId: null })
    expect(result.persistence).toEqual({ status: 'not_persisted', domain: 'finance', reason: 'offline' })
  })
})
