/**
 * ARRIYIA — Intelligence Ledger.
 *
 * The durable, provenance-grounded record of what the six Pro
 * Intelligence engines (Data/Analysis/Research/Planning/Decision/Action)
 * and Execution Foundation actually produced. This is NOT a seventh
 * reasoning engine — it observes and persists what the existing engines
 * already compute, exactly once, at the moment each one completes. It
 * does not decide anything, does not re-run anything, and does not
 * change how any engine reasons.
 *
 * ONE canonical table (`intelligence_records`, see migration
 * 0066_intelligence_ledger.sql), not one per engine — `recordType` is a
 * discriminator, `structuredOutput` holds each engine's own
 * already-typed, already-validated result verbatim (never a raw prompt,
 * never a raw unparsed model completion — see Note below).
 *
 * LINEAGE — two fields, matching Research/Analysis Intelligence's own
 * internal step-chaining convention (`triggeredBy: priorStep?.id ?? null`)
 * made durable, not a new relationship table:
 *   - `journeyId` groups loosely: "these all belong to the same thread."
 *   - `parentRecordId` links precisely: "this record was derived from
 *     THIS one." Never fabricated — null unless a real originating
 *     record id was available at write time (see each engine's own
 *     integration call site).
 *
 * PROVENANCE — never a second provenance system. `provenance` stores
 * exactly what an existing src/shared/provenance/ adapter computed,
 * called once at write time while the engine's result is still in
 * memory. Six record types share the `ProvenanceChain` shape
 * (src/shared/provenance/types.ts); 'execution' uses Execution
 * Foundation's own distinct `ExecutionProvenance` shape (see
 * executionAdapter.ts's own doc comment for why it cannot be forced into
 * `ProvenanceChain`).
 *
 * PERSISTENCE DISCIPLINE — `structuredOutput` is the already-parsed,
 * already-validated object each engine already returns to its own caller
 * today. Never a raw system prompt, never a raw unparsed model
 * completion, never provider credentials.
 *
 * NOT YET BUILT (see docs discussion preceding this migration): Plan ->
 * Decision -> Action UI continuity, proactive monitoring/change
 * detection, outcome evaluation/learning, Voice Intelligence. This
 * module's schema is future-ready for those (see `expectedOutcome`/
 * `actualOutcome`/`outcomeEvaluatedAt` below), but implements none of
 * them.
 */

import type { ProvenanceChain } from '@/shared/provenance/types'
import type { ExecutionProvenance } from '@/shared/provenance/adapters/executionAdapter'
import type { IntelligenceRecordStatus, IntelligenceRecordType } from '@/shared/types/database'

export type { IntelligenceRecordStatus, IntelligenceRecordType }

export interface IntelligenceJourney {
  id: string
  workspaceId: string | null
  userId: string
  objectiveId: string | null
  title: string
  createdAt: string
  updatedAt: string
}

/** Six record types share ProvenanceChain; 'execution' uses its own distinct shape — see this file's own doc comment. */
export type IntelligenceRecordProvenance = ProvenanceChain | ExecutionProvenance

export interface IntelligenceRecord {
  id: string
  workspaceId: string | null
  userId: string
  journeyId: string | null
  recordType: IntelligenceRecordType
  status: IntelligenceRecordStatus
  summary: string
  structuredOutput: Record<string, unknown>
  provenance: IntelligenceRecordProvenance | null
  operationId: string | null
  providerId: string | null
  conversationId: string | null
  executionRequestId: string | null
  parentRecordId: string | null
  /** Reserved for future outcome tracking — never populated or evaluated by this phase. */
  expectedOutcome: string | null
  actualOutcome: string | null
  outcomeEvaluatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateIntelligenceJourneyParams {
  workspaceId: string | null
  objectiveId?: string | null
  title: string
}

export interface CreateIntelligenceRecordParams {
  workspaceId: string | null
  journeyId?: string | null
  recordType: IntelligenceRecordType
  status?: IntelligenceRecordStatus
  summary: string
  structuredOutput: Record<string, unknown>
  provenance?: IntelligenceRecordProvenance | null
  operationId?: string | null
  providerId?: string | null
  conversationId?: string | null
  executionRequestId?: string | null
  parentRecordId?: string | null
  expectedOutcome?: string | null
}
