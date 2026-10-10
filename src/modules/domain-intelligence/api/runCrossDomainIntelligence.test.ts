import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runCrossDomainIntelligence } from '@/modules/domain-intelligence/api/runCrossDomainIntelligence'
import type { CrossDomainEvidenceDescriptor } from '@/modules/domain-intelligence/crossDomainCompatibility'

const { runCapabilityMock, writeIntelligenceRecordMock } = vi.hoisted(() => ({ runCapabilityMock: vi.fn(), writeIntelligenceRecordMock: vi.fn() }))
vi.mock('@/modules/ai/orchestration/runCapability', () => ({ runCapability: runCapabilityMock }))
vi.mock('@/modules/intelligence-ledger/api/writeIntelligenceRecord', () => ({ writeIntelligenceRecord: writeIntelligenceRecordMock }))

function evidence(): CrossDomainEvidenceDescriptor[] {
  const shared = { accessScopeId: 'workspace:workspace-1', unit: 'currency', currency: 'TZS', periodStart: '2026-09-01T00:00:00.000Z', periodEnd: '2026-10-01T00:00:00.000Z', timeZone: 'Africa/Dar_es_Salaam', grain: 'month', asOf: '2026-10-02T00:00:00.000Z' }
  return [
    { ...shared, evidenceId: 'e-finance', domain: 'finance', sourceRef: 'report:finance', metricKey: 'revenue', metricDefinition: 'Recognized revenue' },
    { ...shared, evidenceId: 'e-marketing', domain: 'marketing', sourceRef: 'campaign:spend', metricKey: 'ad_spend', metricDefinition: 'Paid media spend' },
  ]
}
function modelOutput(overrides: Record<string, unknown> = {}) {
  return { schemaVersion: 1, crossDomain: true, domains: ['finance', 'marketing'], evidence: [
    { id: 'e-finance', kind: 'verified_fact', statement: 'Revenue recorded in supplied source.', sourceRef: 'report:finance', confidence: 0.9 },
    { id: 'e-marketing', kind: 'verified_fact', statement: 'Paid media spend recorded in supplied source.', sourceRef: 'campaign:spend', confidence: 0.9 },
  ], findings: [{ id: 'f1', statement: 'Compare revenue and paid media spend over the same monthly period.', evidenceIds: ['e-finance', 'e-marketing'] }], recommendations: [{ id: 'r1', statement: 'Review channel efficiency with the finance and marketing teams.', evidenceIds: ['e-finance', 'e-marketing'], requiresApproval: true }], metadata: { limitations: [], unknowns: [] }, ...overrides }
}

describe('runCrossDomainIntelligence', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    runCapabilityMock.mockResolvedValue({ content: JSON.stringify(modelOutput()), model: 'test-model' })
    writeIntelligenceRecordMock.mockResolvedValue({ id: 'record-1' })
  })
  it('runs only compatible same-scope evidence and persists through the canonical ledger', async () => {
    const result = await runCrossDomainIntelligence({ question: 'How do marketing spend and revenue compare?', userId: 'user-1', workspaceId: 'workspace-1', evidence: evidence(), evidenceContext: 'Authorized monthly revenue and paid-media spend.' })
    expect(runCapabilityMock).toHaveBeenCalledWith(expect.objectContaining({ capabilityId: 'cross-domain-assessment', userId: 'user-1', workspaceId: 'workspace-1' }))
    expect(writeIntelligenceRecordMock).toHaveBeenCalledWith(expect.objectContaining({ recordType: 'analysis', workspaceId: 'workspace-1', structuredOutput: expect.objectContaining({ crossDomain: true }) }))
    expect(result).toMatchObject({ status: 'completed', persistence: { status: 'persisted', recordId: 'record-1' } })
  })
  it('does not invoke the model for incompatible period or authorization scope', async () => {
    const mismatched = evidence().map((item, index) => index ? { ...item, periodEnd: '2026-09-15T00:00:00.000Z' } : item)
    const result = await runCrossDomainIntelligence({ question: 'Compare.', userId: 'user-1', workspaceId: 'workspace-1', evidence: mismatched, evidenceContext: 'source context' })
    expect(result.status).toBe('incompatible')
    expect(runCapabilityMock).not.toHaveBeenCalled()
    const wrongScope = evidence().map(item => ({ ...item, accessScopeId: 'workspace:other' }))
    const scoped = await runCrossDomainIntelligence({ question: 'Compare.', userId: 'user-1', workspaceId: 'workspace-1', evidence: wrongScope, evidenceContext: 'source context' })
    expect(scoped.status).toBe('incompatible')
    expect(runCapabilityMock).not.toHaveBeenCalled()
  })
  it('rejects unknown evidence IDs, changed source references, dangling citations, and unapproved recommendations', async () => {
    runCapabilityMock.mockResolvedValueOnce({ content: JSON.stringify(modelOutput({ evidence: [{ id: 'invented', kind: 'verified_fact', statement: 'Fabricated', sourceRef: 'fake', confidence: 1 }] })), model: 'test-model' })
    await expect(runCrossDomainIntelligence({ question: 'Compare.', userId: 'user-1', workspaceId: 'workspace-1', evidence: evidence(), evidenceContext: 'context' })).rejects.toThrow('unknown ID or altered source reference')
    runCapabilityMock.mockResolvedValueOnce({ content: JSON.stringify(modelOutput({ findings: [{ id: 'f1', statement: 'Unsupported', evidenceIds: ['missing'] }] })), model: 'test-model' })
    await expect(runCrossDomainIntelligence({ question: 'Compare.', userId: 'user-1', workspaceId: 'workspace-1', evidence: evidence(), evidenceContext: 'context' })).rejects.toThrow('missing or dangling evidence')
    runCapabilityMock.mockResolvedValueOnce({ content: JSON.stringify(modelOutput({ recommendations: [{ id: 'r1', statement: 'Act now', evidenceIds: ['e-finance'], requiresApproval: false }] })), model: 'test-model' })
    await expect(runCrossDomainIntelligence({ question: 'Compare.', userId: 'user-1', workspaceId: 'workspace-1', evidence: evidence(), evidenceContext: 'context' })).rejects.toThrow('must require approval')
    expect(writeIntelligenceRecordMock).not.toHaveBeenCalled()
  })
  it('returns explicit non-durable status when ledger persistence fails', async () => {
    writeIntelligenceRecordMock.mockResolvedValueOnce(null)
    const result = await runCrossDomainIntelligence({ question: 'Compare.', userId: 'user-1', workspaceId: 'workspace-1', evidence: evidence(), evidenceContext: 'context' })
    expect(result).toMatchObject({ status: 'completed', persistence: { status: 'not_persisted' } })
  })
})