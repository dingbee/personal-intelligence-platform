import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ARRIYIA — I8 real acceptance scenario: the same "ARRIYIA University
 * Pilot Launch Plan" real fixture already established in I6's own
 * acceptance test (planningIntelligenceAdapter.acceptance.test.ts) and
 * reused again in I7's own i7Acceptance.test.ts — not invented fresh
 * here. Proves the full I8 loop end to end through the REAL TS modules:
 *
 *   I6 PLAN -> I7 ACTION EXECUTION (verified) -> I8 OUTCOME CAPTURE
 *     -> OUTCOME COMPARISON -> LEARNING SIGNAL -> REPEATED EVIDENCE
 *     -> CONTRADICTION -> USER FEEDBACK -> REVOCATION -> ADAPTATION READ
 *
 * Only the Supabase network boundary is faked — createIntelligenceRecord,
 * recordExecutionIntelligenceRecord.ts (including its real I7->I8 auto-
 * wiring), recordIntelligenceOutcome.ts, revokeLearningSignal.ts,
 * gatherRelevantLearningSignals.ts, and the pattern-key derivation
 * helpers all run unmodified, against an in-memory backend that mirrors
 * record_intelligence_outcome()'s own reconciliation algorithm (strength
 * thresholds, contradiction handling, revocation) — those exact
 * semantics are independently, live-verified against production in
 * supabase/tests/learning_intelligence_security_test.sql. This file is
 * the JS-integration/wiring counterpart, not a second authority on what
 * the SQL reconciliation itself does.
 */

const CURRENT_USER = 'user-pilot-owner'

function makeFakeLearningBackend() {
  const records = new Map<string, Record<string, unknown>>()
  const evaluations = new Map<string, Record<string, unknown>>()
  const signals = new Map<string, Record<string, unknown>>()
  const evidence: { id: string; signal_id: string; evaluation_id: string; created_at: string }[] = []
  let seq = 0
  const nowIso = () => new Date().toISOString()

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    switch (fn) {
      case 'create_intelligence_record': {
        const id = `record-${++seq}`
        const row = {
          id,
          workspace_id: args.p_workspace_id ?? null,
          user_id: CURRENT_USER,
          journey_id: args.p_journey_id ?? null,
          record_type: args.p_record_type,
          status: args.p_status ?? 'completed',
          summary: args.p_summary,
          structured_output: args.p_structured_output,
          provenance: args.p_provenance ?? null,
          operation_id: args.p_operation_id ?? null,
          provider_id: args.p_provider_id ?? null,
          conversation_id: args.p_conversation_id ?? null,
          execution_request_id: args.p_execution_request_id ?? null,
          parent_record_id: args.p_parent_record_id ?? null,
          expected_outcome: args.p_expected_outcome ?? null,
          actual_outcome: null,
          outcome_evaluated_at: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        records.set(id, row)
        return { data: row, error: null }
      }
      case 'record_intelligence_outcome': {
        const record = records.get(args.p_record_id as string)
        if (!record) return { data: null, error: new Error('record_intelligence_outcome: record not found or not owned by caller') }

        const evalId = `evaluation-${++seq}`
        const evalRow = {
          id: evalId,
          user_id: CURRENT_USER,
          workspace_id: record.workspace_id,
          record_id: args.p_record_id,
          source: args.p_source,
          expected_outcome: args.p_expected_outcome,
          actual_outcome: args.p_actual_outcome,
          comparison_result: args.p_comparison_result,
          execution_succeeded: args.p_execution_succeeded ?? null,
          feedback_note: args.p_feedback_note ?? null,
          pattern_key: args.p_pattern_key,
          created_at: nowIso(),
        }
        evaluations.set(evalId, evalRow)
        record.actual_outcome = args.p_actual_outcome
        record.outcome_evaluated_at = nowIso()

        if (args.p_comparison_result === 'unknown') return { data: evalRow, error: null }

        const direction = args.p_comparison_result === 'match' || args.p_comparison_result === 'partial_match' ? 'positive' : 'negative'
        const patternKey = args.p_pattern_key as string

        const matching = Array.from(signals.values()).find(
          (s) => s.user_id === CURRENT_USER && s.pattern_key === patternKey && s.direction === direction && (s.status === 'proposed' || s.status === 'active'),
        )
        if (matching) {
          matching.evidence_count = (matching.evidence_count as number) + 1
          matching.strength = (matching.evidence_count as number) >= 4 ? 'strong' : (matching.evidence_count as number) >= 2 ? 'moderate' : 'weak'
          if (matching.status === 'proposed' && (matching.evidence_count as number) >= 2) matching.status = 'active'
          matching.last_evidence_at = nowIso()
          matching.updated_at = nowIso()
          evidence.push({ id: `evidence-${++seq}`, signal_id: matching.id as string, evaluation_id: evalId, created_at: nowIso() })
          return { data: evalRow, error: null }
        }

        const opposing = Array.from(signals.values()).find(
          (s) => s.user_id === CURRENT_USER && s.pattern_key === patternKey && s.direction !== direction && (s.status === 'proposed' || s.status === 'active'),
        )
        if (opposing) opposing.status = 'contested'

        const signalId = `signal-${++seq}`
        const signalRow = {
          id: signalId,
          user_id: CURRENT_USER,
          workspace_id: record.workspace_id,
          record_type: record.record_type,
          pattern_key: patternKey,
          direction,
          statement:
            direction === 'positive' ? `Pattern "${patternKey}" tends to match its expected outcome.` : `Pattern "${patternKey}" tends to miss or contradict its expected outcome.`,
          strength: 'weak',
          status: 'proposed',
          evidence_count: 1,
          contradicts_signal_id: opposing?.id ?? null,
          revoked_reason: null,
          revoked_at: null,
          first_evidence_at: nowIso(),
          last_evidence_at: nowIso(),
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        signals.set(signalId, signalRow)
        evidence.push({ id: `evidence-${++seq}`, signal_id: signalId, evaluation_id: evalId, created_at: nowIso() })
        return { data: evalRow, error: null }
      }
      case 'revoke_learning_signal': {
        const signal = signals.get(args.p_signal_id as string)
        if (!signal) return { data: null, error: new Error('revoke_learning_signal: signal not found') }
        if (signal.status === 'revoked') return { data: null, error: new Error('revoke_learning_signal: signal is already revoked') }
        signal.status = 'revoked'
        signal.revoked_reason = args.p_reason ?? null
        signal.revoked_at = nowIso()
        signal.updated_at = nowIso()
        return { data: signal, error: null }
      }
      default:
        throw new Error(`i8 acceptance fake: unmocked rpc "${fn}"`)
    }
  })

  function makeQuery(rows: Record<string, unknown>[]) {
    const self = {
      eq(col: string, val: unknown) {
        return makeQuery(rows.filter((r) => r[col] === val))
      },
      like(col: string, pattern: string) {
        const prefix = pattern.replace(/%$/, '')
        return makeQuery(rows.filter((r) => typeof r[col] === 'string' && (r[col] as string).startsWith(prefix)))
      },
      order() {
        return self
      },
      single: async () => (rows.length === 1 ? { data: rows[0]!, error: null } : { data: null, error: new Error('not found') }),
      then(resolve: (v: { data: Record<string, unknown>[]; error: null }) => void) {
        resolve({ data: rows, error: null })
      },
    }
    return self
  }

  function from(table: string) {
    const rowsFor: Record<string, () => Record<string, unknown>[]> = {
      intelligence_records: () => Array.from(records.values()),
      intelligence_outcome_evaluations: () => Array.from(evaluations.values()),
      intelligence_learning_signals: () => Array.from(signals.values()),
    }
    return { select: () => makeQuery(rowsFor[table]?.() ?? []) }
  }

  return { rpc, from, records, evaluations, signals, evidence }
}

const backend = makeFakeLearningBackend()
vi.mock('@/shared/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => backend.rpc(...(a as [string, Record<string, unknown>])), from: (t: string) => backend.from(t) },
}))

import { createIntelligenceRecord } from '@/modules/intelligence-ledger/api/createIntelligenceRecord'
import { recordExecutionIntelligenceRecord } from '@/modules/intelligence-ledger/api/recordExecutionIntelligenceRecord'
import { recordIntelligenceOutcome } from '@/modules/learning-intelligence/api/recordIntelligenceOutcome'
import { revokeLearningSignal } from '@/modules/learning-intelligence/api/revokeLearningSignal'
import { gatherRelevantLearningSignals } from '@/modules/learning-intelligence/api/gatherRelevantLearningSignals'
import { listOutcomeEvaluations } from '@/modules/learning-intelligence/api/learningQueries'
import { deriveExecutionPatternKey, derivePlanningPatternKey } from '@/modules/learning-intelligence/api/recordIntelligenceOutcome'
import type { ExecutionAttempt, ExecutionRequest } from '@/modules/execution-foundation/execution'

function mkExecutionRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    id: 'exec-1',
    userId: CURRENT_USER,
    workspaceId: 'ws-pilot',
    status: 'succeeded',
    capability: 'save_action_to_notes',
    target: {},
    inputPayload: {},
    expectedEffect: 'A note is created summarizing the outreach plan',
    riskClassification: 'low',
    externalSideEffects: false,
    actionSnapshot: null,
    source: { kind: 'action', actionId: 'action-1', actionSource: { kind: 'plan', label: 'ARRIYIA University Pilot Launch Plan', planId: 'plan-university-pilot', decisionId: null } },
    idempotencyKey: 'idem-1',
    contractHash: 'hash-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:05:00Z',
    expiresAt: '2026-01-02T00:00:00Z',
    ...overrides,
  }
}

function mkVerifiedAttempt(overrides: Partial<ExecutionAttempt> = {}): ExecutionAttempt {
  return {
    id: 'attempt-1',
    executionRequestId: 'exec-1',
    attemptNumber: 1,
    startedAt: '2026-01-01T00:02:00Z',
    completedAt: '2026-01-01T00:03:00Z',
    outcome: 'succeeded',
    failureKind: null,
    failureMessage: null,
    result: { noteId: 'note-1', verification: { status: 'verified', checkedAt: '2026-01-01T00:03:00Z', details: 'Note note-1 confirmed to exist.' } },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  backend.records.clear()
  backend.evaluations.clear()
  backend.signals.clear()
  backend.evidence.length = 0
})

describe('I8 real acceptance scenario — ARRIYIA university pilot', () => {
  it('I6 Plan -> I7 verified action executions -> I8 automatic outcome capture -> a repeated, corroborated learning signal', async () => {
    // Four separate, real, verified executions of the same capability — the honest, repeatable "condition" I8.6 requires.
    for (let i = 1; i <= 4; i++) {
      await recordExecutionIntelligenceRecord({
        request: mkExecutionRequest({ id: `exec-${i}` }),
        authorizations: [],
        attempts: [mkVerifiedAttempt({ executionRequestId: `exec-${i}`, result: { noteId: `note-${i}`, verification: { status: 'verified', checkedAt: '2026-01-01T00:03:00Z', details: `Note note-${i} confirmed to exist.` } } })],
      })
    }

    const signals = Array.from(backend.signals.values())
    expect(signals).toHaveLength(1)
    const signal = signals[0]!
    // I8.6 — repeated corroboration, never a single event, produced the strong signal.
    expect(signal.evidence_count).toBe(4)
    expect(signal.strength).toBe('strong')
    expect(signal.status).toBe('active')
    expect(signal.pattern_key).toBe(deriveExecutionPatternKey('save_action_to_notes'))
  })

  it('Section 6/7 — a single observation stays weak/proposed; only genuine corroboration promotes it, and contradiction never overwrites history', async () => {
    await recordExecutionIntelligenceRecord({ request: mkExecutionRequest({ id: 'exec-1' }), authorizations: [], attempts: [mkVerifiedAttempt()] })

    const afterOne = Array.from(backend.signals.values())[0]!
    expect(afterOne.strength).toBe('weak')
    expect(afterOne.status).toBe('proposed') // NEVER promoted from one event alone.

    // A second, genuinely CONTRADICTING execution of the same capability (verification mismatch).
    await recordExecutionIntelligenceRecord({
      request: mkExecutionRequest({ id: 'exec-2' }),
      authorizations: [],
      attempts: [mkVerifiedAttempt({ executionRequestId: 'exec-2', result: { noteId: 'note-2', verification: { status: 'mismatch', checkedAt: '2026-01-01T00:03:00Z', details: 'Reported noteId note-2 was not found on re-read.' } } })],
    })

    const allSignals = Array.from(backend.signals.values())
    expect(allSignals).toHaveLength(2)
    const original = allSignals.find((s) => s.id === afterOne.id)!
    const contradicting = allSignals.find((s) => s.id !== afterOne.id)!
    // The original signal is preserved, never deleted or overwritten — only its status changes.
    expect(original.status).toBe('contested')
    expect(original.evidence_count).toBe(1)
    expect(original.direction).toBe('positive')
    expect(contradicting.direction).toBe('negative')
    expect(contradicting.contradicts_signal_id).toBe(original.id)
  })

  it('Section 8 — user feedback disagreeing with a system-observed success is stored separately, never silently marking the system outcome a failure', async () => {
    await recordExecutionIntelligenceRecord({ request: mkExecutionRequest({ id: 'exec-1' }), authorizations: [], attempts: [mkVerifiedAttempt()] })
    const record = Array.from(backend.records.values())[0]!

    await recordIntelligenceOutcome({
      recordId: record.id as string,
      source: 'user_feedback',
      expectedOutcome: record.expected_outcome as string,
      actualOutcome: 'This note was not actually useful to me.',
      comparisonResult: 'miss',
      patternKey: deriveExecutionPatternKey('save_action_to_notes'),
      feedbackNote: 'This note was not actually useful to me.',
    })

    const evaluations = await listOutcomeEvaluations(record.id as string)
    expect(evaluations).toHaveLength(2)
    expect(evaluations[0]!.source).toBe('system_observed')
    expect(evaluations[0]!.comparisonResult).toBe('match')
    expect(evaluations[1]!.source).toBe('user_feedback')
    expect(evaluations[1]!.comparisonResult).toBe('miss')
    // The system's own evaluation was never mutated by the disagreeing feedback.
    expect(evaluations[0]!.actualOutcome).toContain('confirmed to exist')
  })

  it('Section 9 — a revoked signal immediately stops being consumed by future intelligence (adaptation), while its history stays intact', async () => {
    for (let i = 1; i <= 2; i++) {
      await recordExecutionIntelligenceRecord({
        request: mkExecutionRequest({ id: `exec-${i}` }),
        authorizations: [],
        attempts: [mkVerifiedAttempt({ executionRequestId: `exec-${i}`, result: { noteId: `note-${i}`, verification: { status: 'verified', checkedAt: '2026-01-01T00:03:00Z', details: `Note note-${i} confirmed to exist.` } } })],
      })
    }
    const signal = Array.from(backend.signals.values())[0]!
    expect(signal.status).toBe('active')

    const beforeRevoke = await gatherRelevantLearningSignals('execution:capability:')
    expect(beforeRevoke).toHaveLength(1)

    await revokeLearningSignal(signal.id as string, 'No longer trusted')

    const afterRevoke = await gatherRelevantLearningSignals('execution:capability:')
    expect(afterRevoke).toHaveLength(0) // future intelligence no longer consumes it.
    expect(backend.signals.get(signal.id as string)?.status).toBe('revoked') // historical provenance intact, never deleted.
    expect(backend.signals.get(signal.id as string)?.evidence_count).toBe(2) // its evidence history is untouched.
  })

  it('Section 10 — Plan learning and Action learning stay genuinely distinguishable, never collapsed into one generic bucket', async () => {
    // I7 action-derived learning.
    await recordExecutionIntelligenceRecord({ request: mkExecutionRequest({ id: 'exec-1' }), authorizations: [], attempts: [mkVerifiedAttempt()] })

    // I6 plan-derived learning: the plan's own real desiredOutcome, a real user-supplied actual result.
    const planRecord = await createIntelligenceRecord({
      workspaceId: 'ws-pilot',
      recordType: 'planning',
      summary: 'Plan: ARRIYIA University Pilot Launch Plan',
      structuredOutput: { title: 'ARRIYIA University Pilot Launch Plan' },
      expectedOutcome: 'A beta cohort of 50 students actively using ARRIYIA.',
    })
    await recordIntelligenceOutcome({
      recordId: planRecord.id,
      source: 'user_feedback',
      expectedOutcome: 'A beta cohort of 50 students actively using ARRIYIA.',
      actualOutcome: 'Onboarding execution required more support than originally planned — only 20 of 50 students onboarded by the deadline.',
      comparisonResult: 'miss',
      patternKey: derivePlanningPatternKey('timeline_variance'),
      feedbackNote: null,
    })

    const signals = Array.from(backend.signals.values())
    expect(signals).toHaveLength(2)
    const actionSignal = signals.find((s) => s.record_type === 'execution')!
    const planSignal = signals.find((s) => s.record_type === 'planning')!
    expect(actionSignal.id).not.toBe(planSignal.id)
    expect(actionSignal.pattern_key).toBe(deriveExecutionPatternKey('save_action_to_notes'))
    expect(planSignal.pattern_key).toBe(derivePlanningPatternKey('timeline_variance'))
  })
})
