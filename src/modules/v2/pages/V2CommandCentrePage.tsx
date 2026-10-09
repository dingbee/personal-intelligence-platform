import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useV2Space } from '../workspace/SpaceContext'
import { listExecutionRequests, listExecutionAuditEvents } from '@/modules/execution-foundation/api/executionQueries'
import { useAuthorizeExecution } from '@/modules/execution-foundation/hooks/useAuthorizeExecution'
import type { ExecutionAuditEvent, ExecutionRequest } from '@/modules/execution-foundation/execution'

type StatusTone = 'healthy' | 'active' | 'waiting' | 'attention'

const statusLabels: Record<ExecutionRequest['status'], string> = {
  proposed: 'Proposed',
  awaiting_approval: 'Awaiting approval',
  approved: 'Approved',
  executing: 'Executing',
  succeeded: 'Succeeded',
  failed: 'Failed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

const toneForStatus = (status: ExecutionRequest['status']): StatusTone => {
  if (status === 'executing') return 'active'
  if (status === 'awaiting_approval' || status === 'proposed') return 'waiting'
  if (status === 'failed' || status === 'rejected' || status === 'cancelled' || status === 'expired') return 'attention'
  return 'healthy'
}

const toneClass: Record<StatusTone, string> = {
  healthy: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
  active: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
  waiting: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
  attention: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
}

function requestLabel(request: ExecutionRequest): string {
  const snapshot = request.actionSnapshot
  if (snapshot && typeof snapshot.title === 'string' && snapshot.title.trim()) return snapshot.title
  if (request.source.kind === 'action') return request.source.actionSource.label
  return request.source.label
}

function relativeTime(value: string): string {
  const delta = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.round(delta / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.round(hours / 24)} d ago`
}

async function listRecentEvents(requests: ExecutionRequest[]): Promise<ExecutionAuditEvent[]> {
  const events = await Promise.all(
    requests.slice(0, 6).map((request) => listExecutionAuditEvents(request.id)),
  )
  return events.flat().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  ).slice(0, 8)
}

export function V2CommandCentrePage() {
  const { activeSpace } = useV2Space()
  const queryClient = useQueryClient()
  const workspaceId = activeSpace?.kind === 'business' ? activeSpace.spaceId : null
  const authorization = useAuthorizeExecution(workspaceId)

  const requestsQuery = useQuery({
    queryKey: ['v2-command-centre-requests', workspaceId],
    queryFn: () => listExecutionRequests(workspaceId),
    enabled: Boolean(activeSpace),
    staleTime: 10_000,
  })

  const requests = requestsQuery.data ?? []
  const pendingApprovals = useMemo(
    () => requests.filter((request) => request.status === 'awaiting_approval'),
    [requests],
  )
  const activeRuns = useMemo(
    () => requests.filter((request) => request.status === 'executing' || request.status === 'approved'),
    [requests],
  )
  const attentionCount = useMemo(
    () => requests.filter((request) => ['failed', 'rejected', 'cancelled', 'expired'].includes(request.status)).length,
    [requests],
  )

  const eventsQuery = useQuery({
    queryKey: ['v2-command-centre-events', workspaceId, requests.map((request) => request.id).join(',')],
    queryFn: () => listRecentEvents(requests),
    enabled: requests.length > 0,
    staleTime: 10_000,
  })

  const approve = (executionRequestId: string) => {
    authorization.mutate(
      { executionRequestId, decision: 'approved' },
      { onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['v2-command-centre-requests', workspaceId] }) },
    )
  }

  const reject = (executionRequestId: string) => {
    authorization.mutate(
      { executionRequestId, decision: 'rejected' },
      { onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['v2-command-centre-requests', workspaceId] }) },
    )
  }

  const scopeLabel = activeSpace?.kind === 'business'
    ? activeSpace.name
    : 'Personal Space'

  return (
    <div className="min-h-full bg-[var(--surface-base)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1">ARRIYIA V2</span>
                <span>CONTROL PLANE</span>
                <span>·</span>
                <span>{scopeLabel}</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
                Command Centre
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                The operating surface for governed actions, approvals, execution state and runtime events.
                V2 owns control and context; NoVA Core remains the execution authority.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link to="/v2" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]">Command Centre</Link>
              <Link to="/v2/intelligence" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">Intelligence</Link>
              <Link to="/v2/agents" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">Agents</Link>
              <Link to="/v2/workflows" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">Workflows</Link>
              <Link to="/v2/knowledge-memory" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">Knowledge</Link>
            </nav>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Governed requests', requests.length, 'Execution requests visible in this Space.'],
            ['Active runs', activeRuns.length, 'Approved or executing work awaiting completion.'],
            ['Approvals', pendingApprovals.length, 'Requests requiring an explicit authorization decision.'],
            ['Attention', attentionCount, 'Failed, rejected, cancelled or expired requests.'],
          ].map(([label, value, detail]) => (
            <article key={label} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
              <div className="text-xs text-[var(--text-secondary)]">{label}</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{value}</div>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{detail}</p>
            </article>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Execution state</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Live governed requests for the active Space.</p>
              </div>
              <Link to="/executions" className="text-xs font-medium text-[var(--text-primary)] underline-offset-4 hover:underline">Open execution ledger →</Link>
            </div>
            {requestsQuery.isLoading ? (
              <p className="mt-5 text-sm text-[var(--text-secondary)]">Loading execution state…</p>
            ) : requestsQuery.isError ? (
              <p className="mt-5 text-sm text-[var(--text-secondary)]">Execution state is unavailable for this Space.</p>
            ) : requests.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-subtle)] p-5">
                <div className="font-medium text-[var(--text-primary)]">No governed requests yet</div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">The Command Centre is connected to the existing execution foundation and will populate as governed actions enter the control plane.</p>
              </div>
            ) : (
              <div className="mt-5 divide-y divide-[var(--border-subtle)]">
                {requests.slice(0, 8).map((request) => (
                  <div key={request.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[var(--text-primary)]">{requestLabel(request)}</div>
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">
                        {request.capability} · {request.riskClassification} risk · {relativeTime(request.createdAt)}
                      </div>
                    </div>
                    <span className={`w-fit shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] ${toneClass[toneForStatus(request.status)]}`}>
                      {statusLabels[request.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Approval queue</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Authorization is a decision, not a status toggle.</p>
            <div className="mt-5 space-y-3">
              {pendingApprovals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--text-secondary)]">No approvals waiting.</div>
              ) : pendingApprovals.slice(0, 5).map((request) => (
                <article key={request.id} className="rounded-2xl border border-[var(--border-subtle)] p-4">
                  <div className="font-medium text-sm text-[var(--text-primary)]">{requestLabel(request)}</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{request.expectedEffect}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={authorization.isPending}
                      onClick={() => approve(request.id)}
                      className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={authorization.isPending}
                      onClick={() => reject(request.id)}
                      className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent control events</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Audit events attached to the latest governed requests.</p>
            </div>
          </div>
          <div className="mt-5">
            {eventsQuery.isLoading ? (
              <p className="text-sm text-[var(--text-secondary)]">Loading events…</p>
            ) : (eventsQuery.data ?? []).length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--text-secondary)]">No control events yet.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {(eventsQuery.data ?? []).map((event) => (
                  <article key={event.id} className="rounded-2xl border border-[var(--border-subtle)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{event.eventType.replaceAll('_', ' ')}</span>
                      <span className="text-[11px] text-[var(--text-secondary)]">{relativeTime(event.createdAt)}</span>
                    </div>
                    <div className="mt-2 text-xs text-[var(--text-secondary)]">Request {event.executionRequestId.slice(0, 8)}…</div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Actions</div>
            <h2 className="mt-2 font-semibold text-[var(--text-primary)]">Governed action plane</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Every execution request retains its capability, target, risk classification, provenance and contract hash.</p>
          </article>
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Agents + Workflows</div>
            <h2 className="mt-2 font-semibold text-[var(--text-primary)]">Control surfaces are separate</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Agent definitions and workflow definitions remain their own V2 resources; this centre coordinates their governed activity rather than duplicating them.</p>
          </article>
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Runtime</div>
            <h2 className="mt-2 font-semibold text-[var(--text-primary)]">NoVA remains external</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">ARRIYIA V2 records control state and authorization; NoVA Core remains the runtime and execution authority across the plugin boundary.</p>
          </article>
        </section>
      </div>
    </div>
  )
}
