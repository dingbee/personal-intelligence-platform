import { useState } from 'react'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useExecutionRequests } from '@/modules/execution-foundation/hooks/useExecutionRequests'
import { useExecutionRequestDetail } from '@/modules/execution-foundation/hooks/useExecutionRequestDetail'
import { useAuthorizeExecution } from '@/modules/execution-foundation/hooks/useAuthorizeExecution'
import { useExecuteCapability } from '@/modules/execution-foundation/hooks/useExecuteCapability'
import { useCancelExecution } from '@/modules/execution-foundation/hooks/useCancelExecution'
import { getCapability } from '@/modules/execution-foundation/api/capabilityRegistry'
import { canAuthorize, canCancel, canStart } from '@/modules/execution-foundation/api/executionStateMachine'
import type { ExecutionRequest, ExecutionRequestStatus } from '@/modules/execution-foundation/execution'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'error' | 'neutral'

const STATUS_BADGE: Record<ExecutionRequestStatus, { label: string; variant: BadgeVariant }> = {
  proposed: { label: 'Proposed', variant: 'neutral' },
  awaiting_approval: { label: 'Awaiting your approval', variant: 'warning' },
  approved: { label: 'Approved — not yet run', variant: 'info' },
  rejected: { label: 'Rejected', variant: 'error' },
  executing: { label: 'Running…', variant: 'info' },
  succeeded: { label: 'Succeeded', variant: 'success' },
  failed: { label: 'Failed', variant: 'error' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
  expired: { label: 'Expired', variant: 'neutral' },
}

const RISK_BADGE: Record<string, BadgeVariant> = { low: 'success', medium: 'warning', high: 'error' }

const VERIFICATION_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  verified: { label: 'Outcome verified', variant: 'success' },
  mismatch: { label: 'Outcome mismatch', variant: 'error' },
  unverified: { label: 'Outcome unverified', variant: 'warning' },
}

/** I7.12/I7.13 — the attempt's own `outcome` is the self-reported execution result; a nested `result.verification` (when present) is the independently re-read, possibly-disagreeing observed outcome. Never assume a shape here — an attempt with no verification is legitimately unverified, not a rendering bug. */
function attemptVerification(attempt: { result: Record<string, unknown> | null }): { status: string } | null {
  const verification = attempt.result?.verification
  return verification && typeof verification === 'object' && 'status' in verification ? (verification as { status: string }) : null
}

function ExecutionHistory({ executionRequestId }: { executionRequestId: string }) {
  const { data, isLoading } = useExecutionRequestDetail(executionRequestId)

  if (isLoading) return <Spinner size="sm" />
  if (!data) return null

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-[var(--color-border)] pt-2 text-xs">
      {data.authorizations.length > 0 && (
        <div>
          <p className="font-medium text-[var(--color-ink-muted)]">Authorization</p>
          {data.authorizations.map((a) => (
            <p key={a.id} className="text-[var(--color-ink-muted)]">
              {a.decision} by user at {new Date(a.createdAt).toLocaleString()}
            </p>
          ))}
        </div>
      )}
      {data.attempts.length > 0 && (
        <div>
          <p className="font-medium text-[var(--color-ink-muted)]">Attempts</p>
          {data.attempts.map((a) => {
            const verification = attemptVerification(a)
            const verificationBadge = verification ? VERIFICATION_BADGE[verification.status] : null
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-1 py-0.5">
                <p className="text-[var(--color-ink-muted)]">
                  #{a.attemptNumber}: {a.outcome ?? 'in progress'}
                  {a.failureKind && ` (${a.failureKind}${a.failureMessage ? `: ${a.failureMessage}` : ''})`}
                </p>
                {verificationBadge && <StatusBadge label={verificationBadge.label} variant={verificationBadge.variant} />}
              </div>
            )
          })}
        </div>
      )}
      {data.auditEvents.length > 0 && (
        <div>
          <p className="font-medium text-[var(--color-ink-muted)]">Audit trail</p>
          <ul className="flex flex-col gap-0.5">
            {data.auditEvents.map((e) => (
              <li key={e.id} className="text-[var(--color-ink-muted)]">
                {e.eventType} — {new Date(e.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ExecutionRequestCard({ request, workspaceId }: { request: ExecutionRequest; workspaceId: string | null }) {
  const [showHistory, setShowHistory] = useState(false)
  const authorizeMutation = useAuthorizeExecution(workspaceId)
  const executeMutation = useExecuteCapability(workspaceId)
  const cancelMutation = useCancelExecution(workspaceId)
  const capability = getCapability(request.capability)
  const statusBadge = STATUS_BADGE[request.status]

  return (
    <li className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge label={statusBadge.label} variant={statusBadge.variant} />
        <StatusBadge label={`Risk: ${request.riskClassification}`} variant={RISK_BADGE[request.riskClassification] ?? 'neutral'} />
        {request.externalSideEffects && <StatusBadge label="External side effect" variant="error" />}
      </div>

      <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">{capability?.label ?? request.capability}</p>
      <p className="mt-0.5 text-[var(--color-ink-muted)]">{request.expectedEffect}</p>
      <p className="mt-1 text-[var(--color-ink-muted)]">
        Source: {request.source.kind === 'action' ? `Action Intelligence (${request.source.actionSource.label})` : request.source.label}
      </p>
      {request.source.kind === 'action' && (request.source.actionSource.planId || request.source.actionSource.decisionId) && (
        <p className="mt-0.5 text-[var(--color-ink-muted)]">
          {/* I7.19 — real, honest provenance carried straight through from the originating Plan/Decision id, never fabricated. */}
          Traced to: {request.source.actionSource.planId && `Plan ${request.source.actionSource.planId}`}
          {request.source.actionSource.planId && request.source.actionSource.decisionId && ' · '}
          {request.source.actionSource.decisionId && `Decision ${request.source.actionSource.decisionId}`}
        </p>
      )}

      {request.status === 'awaiting_approval' && (
        <div className="mt-2 rounded-control border border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)] p-2 text-[var(--color-warning-strong)]">
          ARRIYIA is asking permission to do this. Nothing has happened yet.
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {canAuthorize(request.status) && (
          <>
            <button
              type="button"
              onClick={() => authorizeMutation.mutate({ executionRequestId: request.id, decision: 'approved' })}
              disabled={authorizeMutation.isPending}
              className="rounded-control bg-[var(--color-accent)] px-2 py-1 text-[10px] font-medium text-[var(--color-canvas)] disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => authorizeMutation.mutate({ executionRequestId: request.id, decision: 'rejected' })}
              disabled={authorizeMutation.isPending}
              className="rounded-control border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink-muted)] disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
        {canStart(request.status) && (
          <button
            type="button"
            onClick={() => executeMutation.mutate(request.id)}
            disabled={executeMutation.isPending}
            className="rounded-control bg-[var(--color-accent)] px-2 py-1 text-[10px] font-medium text-[var(--color-canvas)] disabled:opacity-50"
          >
            {executeMutation.isPending ? 'Running…' : 'Run'}
          </button>
        )}
        {canCancel(request.status) && (
          <button
            type="button"
            onClick={() => cancelMutation.mutate({ executionRequestId: request.id })}
            disabled={cancelMutation.isPending}
            className="rounded-control border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink-muted)] disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="rounded-control border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink-muted)]"
        >
          {showHistory ? 'Hide history' : 'View history'}
        </button>
      </div>

      {(authorizeMutation.isError || executeMutation.isError || cancelMutation.isError) && (
        <p role="alert" className="mt-1 text-[10px] text-[var(--color-danger)]">
          {errorMessage(authorizeMutation.error ?? executeMutation.error ?? cancelMutation.error, 'Something went wrong.')}
        </p>
      )}

      {showHistory && <ExecutionHistory executionRequestId={request.id} />}
    </li>
  )
}

/**
 * The controlled Execution UI (sprint brief Phase 14). Deliberately not
 * an autonomous-agent dashboard: every action here is either reviewing a
 * request, granting/denying permission, or explicitly running something
 * already approved — there is no "ARRIYIA will now handle this
 * automatically" affordance anywhere. A request awaiting approval is
 * always shown with the explicit "asking permission" framing (Phase 13's
 * own requirement) so READY/APPROVED/EXECUTED are never visually
 * conflated.
 */
export function ExecutionsPage() {
  const { currentWorkspaceId } = useWorkspace()
  const { data: requests, isLoading } = useExecutionRequests(currentWorkspaceId)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        level="page"
        title="Executions"
        description="Approved Action Intelligence actions, waiting for or under your explicit permission. ARRIYIA never runs anything here on its own — every request sits until you approve it, and only ever performs a capability it actually has."
      />

      <SurfaceCard className="flex flex-col gap-3">
        {isLoading ? (
          <Spinner size="sm" />
        ) : !requests || requests.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">No execution requests yet. Propose one from an action on the Actions page.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {requests.map((request) => (
              <ExecutionRequestCard key={request.id} request={request} workspaceId={currentWorkspaceId} />
            ))}
          </ul>
        )}
      </SurfaceCard>
    </div>
  )
}
