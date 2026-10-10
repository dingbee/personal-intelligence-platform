import { describe, expect, it } from 'vitest'
import { validateDomainIntelligenceOutput } from '@/modules/intelligence-ledger/domainContract'

const valid = {
  schemaVersion: 1,
  domain: 'finance',
  evidence: [{ id: 'e1', kind: 'verified_fact', statement: 'Revenue is recorded', sourceRef: 'report:1', confidence: 1 }],
  findings: [{ id: 'f1', statement: 'Revenue increased', evidenceIds: ['e1'] }],
  recommendations: [{ id: 'r1', statement: 'Review margins', evidenceIds: ['e1'], requiresApproval: true }],
}

describe('IF-02 domain output contract', () => {
  it('accepts an envelope with explicit domain, evidence classification, and linked evidence', () => {
    expect(validateDomainIntelligenceOutput(valid, 'finance')).toBe(true)
  })

  it('rejects a domain mismatch', () => {
    expect(validateDomainIntelligenceOutput(valid, 'risk')).toBe(false)
  })

  it('rejects a finding that cites nonexistent evidence', () => {
    expect(validateDomainIntelligenceOutput({
      ...valid,
      findings: [{ id: 'f1', statement: 'Unsupported', evidenceIds: ['missing'] }],
    }, 'finance')).toBe(false)
  })

  it('rejects findings and recommendations with empty evidence citations', () => {
    expect(validateDomainIntelligenceOutput({
      ...valid,
      findings: [{ id: 'f1', statement: 'Unsupported finding', evidenceIds: [] }],
    }, 'finance')).toBe(false)
    expect(validateDomainIntelligenceOutput({
      ...valid,
      recommendations: [{ id: 'r1', statement: 'Unsupported recommendation', evidenceIds: [], requiresApproval: true }],
    }, 'finance')).toBe(false)
  })

  it('rejects duplicate evidence identifiers and out-of-range confidence', () => {
    expect(validateDomainIntelligenceOutput({
      ...valid,
      evidence: [
        ...valid.evidence,
        { id: 'e1', kind: 'assumption', statement: 'Duplicate', sourceRef: null, confidence: 1.5 },
      ],
    }, 'finance')).toBe(false)
  })

  it('rejects unclassified evidence kinds', () => {
    expect(validateDomainIntelligenceOutput({
      ...valid,
      evidence: [{ id: 'e2', kind: 'fact-ish', statement: 'Not verified', sourceRef: null, confidence: null }],
    }, 'finance')).toBe(false)
  })
})
