import type { ExecutionAttempt, ExecutionAuthorization, ExecutionAuthorizationDecision, ExecutionFailureKind, ExecutionRequest, ExecutionSource } from '@/modules/execution-foundation/execution'

/**
 * Execution Foundation's own provenance adapter — deliberately NOT
 * forced into the shared evidence/derivation ProvenanceChain shape (see
 * src/shared/provenance/types.ts). That shape requires a derivation to
 * cite real, resolved EvidenceReference objects (source type/title/
 * excerpt); an ExecutionRequest only carries the originating Action's
 * own evidence *ids* (via actionSnapshot), not the full SourceReference
 * data those ids point to — resolving them is Action Intelligence's
 * own provenance adapter's job (actionIntelligenceAdapter.ts), and
 * duplicating that resolution here would risk it drifting out of sync.
 * Rather than fabricate titles/excerpts to force-fit the shared shape,
 * this adapter answers the sprint brief's own eight provenance
 * questions directly and honestly, with `actionEvidenceIds` exposed as
 * real, unresolved, traceable ids — never invented reference data.
 */
export interface ExecutionProvenanceAuthorization {
  approvingUserId: string
  decision: ExecutionAuthorizationDecision
  capability: string
  target: Record<string, unknown>
  scope: Record<string, unknown>
  grantedAt: string
}

export interface ExecutionProvenanceAttempt {
  attemptNumber: number
  outcome: 'succeeded' | 'failed' | null
  failureKind: ExecutionFailureKind | null
  completedAt: string | null
}

export interface ExecutionProvenance {
  /** Why this request exists and which Action Intelligence action (or manual UI action) produced it. */
  source: ExecutionSource
  /** The originating action's own cited evidence ids — real, never fabricated; resolve via Action Intelligence's own provenance if the full source detail is needed. */
  actionEvidenceIds: string[]
  /** Who authorized it, exactly what was authorized, and when — null when no authorization has been recorded yet. */
  authorization: ExecutionProvenanceAuthorization | null
  /** What actually happened — every attempt, in order. */
  attempts: ExecutionProvenanceAttempt[]
  /** The real result of the successful attempt, when one exists — never fabricated when execution hasn't succeeded (null). */
  result: Record<string, unknown> | null
}

function extractActionEvidenceIds(actionSnapshot: Record<string, unknown> | null): string[] {
  if (!actionSnapshot) return []
  const ids = actionSnapshot.evidenceIds
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
}

export function describeExecutionProvenance(request: ExecutionRequest, authorizations: ExecutionAuthorization[], attempts: ExecutionAttempt[]): ExecutionProvenance {
  const latestAuthorization = [...authorizations].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  const successfulAttempt = attempts.find((a) => a.outcome === 'succeeded') ?? null

  return {
    source: request.source,
    actionEvidenceIds: extractActionEvidenceIds(request.actionSnapshot),
    authorization: latestAuthorization
      ? {
          approvingUserId: latestAuthorization.approvingUserId,
          decision: latestAuthorization.decision,
          capability: latestAuthorization.capability,
          target: latestAuthorization.target,
          scope: latestAuthorization.scope,
          grantedAt: latestAuthorization.createdAt,
        }
      : null,
    attempts: attempts.map((a) => ({ attemptNumber: a.attemptNumber, outcome: a.outcome, failureKind: a.failureKind, completedAt: a.completedAt })),
    result: successfulAttempt?.result ?? null,
  }
}
