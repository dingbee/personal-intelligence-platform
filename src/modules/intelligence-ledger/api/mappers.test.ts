import { describe, expect, it } from 'vitest'
import { toIntelligenceJourney, toIntelligenceRecord } from '@/modules/intelligence-ledger/api/mappers'
import type { IntelligenceJourneyRow, IntelligenceRecordRow } from '@/shared/types/database'

describe('toIntelligenceJourney', () => {
  it('maps every snake_case column to its camelCase field, unchanged', () => {
    const row: IntelligenceJourneyRow = {
      id: 'journey-1',
      workspace_id: 'workspace-1',
      user_id: 'user-1',
      objective_id: 'objective-1',
      title: 'Q3 pricing research',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    }

    expect(toIntelligenceJourney(row)).toEqual({
      id: 'journey-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      objectiveId: 'objective-1',
      title: 'Q3 pricing research',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    })
  })

  it('preserves null workspaceId/objectiveId rather than coercing them', () => {
    const row: IntelligenceJourneyRow = {
      id: 'journey-2',
      workspace_id: null,
      user_id: 'user-1',
      objective_id: null,
      title: 'Personal exploration',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }

    const journey = toIntelligenceJourney(row)
    expect(journey.workspaceId).toBeNull()
    expect(journey.objectiveId).toBeNull()
  })
})

describe('toIntelligenceRecord', () => {
  function baseRow(overrides: Partial<IntelligenceRecordRow> = {}): IntelligenceRecordRow {
    return {
      id: 'record-1',
      workspace_id: 'workspace-1',
      user_id: 'user-1',
      journey_id: 'journey-1',
      record_type: 'research',
      status: 'completed',
      summary: 'Research Intelligence: what changed in Q3?',
      structured_output: { question: 'what changed in Q3?' },
      provenance: { evidence: [], derivations: [] },
      operation_id: 'operation-1',
      provider_id: 'openai',
      conversation_id: null,
      execution_request_id: null,
      parent_record_id: null,
      expected_outcome: null,
      actual_outcome: null,
      outcome_evaluated_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      ...overrides,
    }
  }

  it('maps every snake_case column to its camelCase field, unchanged', () => {
    const record = toIntelligenceRecord(baseRow())

    expect(record).toEqual({
      id: 'record-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      journeyId: 'journey-1',
      recordType: 'research',
      status: 'completed',
      summary: 'Research Intelligence: what changed in Q3?',
      structuredOutput: { question: 'what changed in Q3?' },
      provenance: { evidence: [], derivations: [] },
      operationId: 'operation-1',
      providerId: 'openai',
      conversationId: null,
      executionRequestId: null,
      parentRecordId: null,
      expectedOutcome: null,
      actualOutcome: null,
      outcomeEvaluatedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
  })

  it('never fabricates a parentRecordId — a null column stays null', () => {
    const record = toIntelligenceRecord(baseRow({ parent_record_id: null }))
    expect(record.parentRecordId).toBeNull()
  })

  it('preserves a real parentRecordId/journeyId when the column has one', () => {
    const record = toIntelligenceRecord(baseRow({ parent_record_id: 'record-0', journey_id: 'journey-9' }))
    expect(record.parentRecordId).toBe('record-0')
    expect(record.journeyId).toBe('journey-9')
  })

  it('passes a null provenance through unchanged (execution or unattributed records)', () => {
    const record = toIntelligenceRecord(baseRow({ provenance: null }))
    expect(record.provenance).toBeNull()
  })
})
