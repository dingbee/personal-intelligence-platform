import { describe, expect, it } from 'vitest'
import type { IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'

const record = (recordType: IntelligenceRecord['recordType']): IntelligenceRecord => ({
  id: recordType,
  workspaceId: 'space-1',
  userId: 'user-1',
  journeyId: null,
  domainKey: null,
  recordType,
  status: 'completed',
  summary: `${recordType} record`,
  structuredOutput: {},
  provenance: null,
  operationId: null,
  providerId: null,
  conversationId: null,
  executionRequestId: null,
  parentRecordId: null,
  expectedOutcome: null,
  actualOutcome: null,
  outcomeEvaluatedAt: null,
  createdAt: '2026-10-06T10:00:00.000Z',
  updatedAt: '2026-10-06T10:00:00.000Z',
})

describe('V2 Intelligence Centre evidence boundary', () => {
  it('keeps the six-stage model distinct from legacy ledger record types', () => {
    expect(record('data').recordType).toBe('data')
    expect(record('analysis').recordType).toBe('analysis')
    expect(record('decision').recordType).toBe('decision')
    expect(record('execution').recordType).toBe('execution')
  })

  it('preserves Space scope on evidence records', () => {
    expect(record('research').workspaceId).toBe('space-1')
  })

  it('does not pretend legacy records are canonical V2 resources', () => {
    expect(record('data').recordType).not.toBe('signal')
    expect(record('analysis').recordType).not.toBe('insight')
    expect(record('decision').recordType).not.toBe('recommendation')
  })
})
